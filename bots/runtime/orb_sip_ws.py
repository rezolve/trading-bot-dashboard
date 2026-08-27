#!/usr/bin/env python3
"""
Opening Range Breakout (ORB) Websocket Bot - PAPER ONLY

This bot connects to Alpaca's SIP market data websocket to trade an opening range
breakout strategy on SPY. It CANNOT use MCP because we need to hold the websocket
connection open and react in real-time.

Key behaviors:
- Connects to wss://stream.data.alpaca.markets/v2/sip for 1-minute bars
- Minute bars emit AFTER the minute close (e.g., 09:30 bar arrives at 09:31:00)
- Opening range = high/low from 09:30-09:45 ET (range known after 09:45 bar completes)
- Long signal: first 1min close above range high AND SMA10 > SMA30 (daily)
- Flatten before 15:55 ET
- Checks Firestore bots/bot_orb_spy paperLive flag before trading
- REFUSES to start if APCA_API_BASE_URL contains 'live' or doesn't contain 'paper'
- TradingClient(paper=True) ONLY
- Keys from env APCA_API_KEY_ID / APCA_API_SECRET_KEY (never logged)

Session: America/New_York
Max position size: 10% equity or $10k notional, whichever smaller
Client order ID prefix: orbspy-YYYYMMDD-

PAPER ONLY. NO LIVE TRADING.
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Optional, Dict, Any
import pytz

# Alpaca
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.live import StockDataStream

# Firebase
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Timezone
ET = pytz.timezone('America/New_York')

# Bot ID
BOT_ID = 'bot_orb_spy'


class ORBBot:
    """Opening Range Breakout bot for SPY - PAPER ONLY"""
    
    def __init__(self):
        self.symbol = 'SPY'
        self.api_key = os.getenv('APCA_API_KEY_ID')
        self.api_secret = os.getenv('APCA_API_SECRET_KEY')
        self.api_base_url = os.getenv('APCA_API_BASE_URL', '')
        
        # PAPER-ONLY ENFORCEMENT
        if not self.api_base_url:
            logger.error("APCA_API_BASE_URL not set")
            sys.exit(1)
        if 'paper' not in self.api_base_url.lower():
            logger.error(f"APCA_API_BASE_URL does not contain 'paper': {self.api_base_url}")
            logger.error("REFUSING TO START - PAPER ONLY")
            sys.exit(1)
        if 'live' in self.api_base_url.lower() or 'api.alpaca.markets' == self.api_base_url.lower():
            logger.error(f"APCA_API_BASE_URL appears to be LIVE: {self.api_base_url}")
            logger.error("REFUSING TO START - PAPER ONLY")
            sys.exit(1)
        
        logger.info(f"✓ Paper-only check passed: {self.api_base_url}")
        
        # Clients (paper=True enforced)
        self.trading_client = TradingClient(
            api_key=self.api_key,
            secret_key=self.api_secret,
            paper=True  # FORCE PAPER
        )
        self.data_client = StockHistoricalDataClient(
            api_key=self.api_key,
            secret_key=self.api_secret
        )
        self.stream = StockDataStream(
            api_key=self.api_key,
            secret_key=self.api_secret
        )
        
        # Firebase
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        self.db = firestore.client()
        
        # State
        self.range_high: Optional[float] = None
        self.range_low: Optional[float] = None
        self.range_set = False
        self.sma10_above_sma30 = False
        self.position_taken = False
        self.flattened = False
        self.bars_in_range = []  # 09:30-09:45 bars
        
        # Trading session
        self.session_date = self._get_session_date()
        self.order_prefix = f"orbspy-{self.session_date.strftime('%Y%m%d')}-"
        
    def _get_session_date(self) -> datetime:
        """Get current session date in ET"""
        now_et = datetime.now(ET)
        # If before 4am ET, consider it previous day's session
        if now_et.hour < 4:
            return (now_et - timedelta(days=1)).date()
        return now_et.date()
    
    def _is_market_hours(self) -> bool:
        """Check if we're in regular market hours (9:30-16:00 ET)"""
        now_et = datetime.now(ET).time()
        return time(9, 30) <= now_et <= time(16, 0)
    
    def _is_opening_range(self, bar_time: datetime) -> bool:
        """Check if bar is in opening range (9:30-9:45 ET)"""
        bar_et = bar_time.astimezone(ET).time()
        return time(9, 30) <= bar_et < time(9, 45)
    
    def _should_flatten(self) -> bool:
        """Check if we should flatten before close (15:55 ET)"""
        now_et = datetime.now(ET).time()
        return now_et >= time(15, 55) and not self.flattened
    
    async def _check_paper_live_flag(self) -> bool:
        """Check if bot is enabled in Firestore (paperLive flag)"""
        try:
            bot_ref = self.db.collection('bots').document(BOT_ID)
            bot_doc = bot_ref.get()
            if not bot_doc.exists:
                logger.warning(f"Bot {BOT_ID} not found in Firestore")
                return False
            
            bot_data = bot_doc.to_dict()
            paper_live = bot_data.get('paperLive', False)
            kill_switch = bot_data.get('killSwitch', False)
            
            if kill_switch:
                logger.info("Kill switch active - trading disabled")
                return False
            
            return paper_live
        except Exception as e:
            logger.error(f"Error checking paperLive flag: {e}")
            return False
    
    async def _write_activity(self, event_type: str, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Write activity event to Firestore"""
        try:
            activity_ref = self.db.collection('bot-activity')
            activity_ref.add({
                'botId': BOT_ID,
                'userId': 'system',  # Or fetch from bot doc
                'eventType': event_type,
                'message': message,
                'metadata': metadata or {},
                'createdAt': firestore.SERVER_TIMESTAMP
            })
            logger.info(f"Activity logged: {message}")
        except Exception as e:
            logger.error(f"Error writing activity: {e}")
    
    async def _fetch_sma_filter(self):
        """Fetch SPY daily bars and compute SMA10 vs SMA30 filter"""
        try:
            logger.info("Fetching SPY daily bars for SMA calculation...")
            end_date = datetime.now(ET)
            start_date = end_date - timedelta(days=60)  # Get 60 days for SMA30
            
            request = StockBarsRequest(
                symbol_or_symbols=self.symbol,
                timeframe=TimeFrame.Day,
                start=start_date,
                end=end_date
            )
            
            bars = self.data_client.get_stock_bars(request)
            spy_bars = bars[self.symbol]
            
            if len(spy_bars) < 30:
                logger.warning(f"Insufficient daily bars for SMA30: {len(spy_bars)}")
                self.sma10_above_sma30 = False
                return
            
            # Calculate SMAs from closing prices
            closes = [bar.close for bar in spy_bars]
            sma10 = sum(closes[-10:]) / 10
            sma30 = sum(closes[-30:]) / 30
            
            self.sma10_above_sma30 = sma10 > sma30
            
            logger.info(f"SMA10: {sma10:.2f}, SMA30: {sma30:.2f}")
            logger.info(f"SMA Filter: {'PASS (10>30)' if self.sma10_above_sma30 else 'FAIL (10<=30)'}")
            
            await self._write_activity(
                'sma_calculated',
                f"SMA10={sma10:.2f}, SMA30={sma30:.2f}, Filter={'PASS' if self.sma10_above_sma30 else 'FAIL'}",
                {'sma10': sma10, 'sma30': sma30, 'pass': self.sma10_above_sma30}
            )
            
        except Exception as e:
            logger.error(f"Error fetching SMA data: {e}")
            self.sma10_above_sma30 = False
    
    async def _handle_bar(self, bar):
        """Handle incoming 1-minute bar"""
        try:
            # Bar timestamp is when the bar completed
            bar_time = bar.timestamp
            bar_et = bar_time.astimezone(ET)
            
            logger.info(f"Bar {bar_et.strftime('%H:%M')}: O={bar.open:.2f} H={bar.high:.2f} L={bar.low:.2f} C={bar.close:.2f}")
            
            # Opening range collection (9:30-9:45)
            if self._is_opening_range(bar_time) and not self.range_set:
                self.bars_in_range.append(bar)
                logger.info(f"Opening range bar {len(self.bars_in_range)}/15 collected")
            
            # After 9:45 bar completes, set range
            if not self.range_set and bar_et.time() >= time(9, 45):
                if len(self.bars_in_range) > 0:
                    self.range_high = max(b.high for b in self.bars_in_range)
                    self.range_low = min(b.low for b in self.bars_in_range)
                    self.range_set = True
                    
                    logger.info(f"✓ Opening range set: HIGH={self.range_high:.2f}, LOW={self.range_low:.2f}")
                    await self._write_activity(
                        'range_set',
                        f"Opening range: {self.range_low:.2f} - {self.range_high:.2f}",
                        {'high': self.range_high, 'low': self.range_low, 'bars': len(self.bars_in_range)}
                    )
            
            # Check for breakout signal (after range is set)
            if self.range_set and not self.position_taken and not self.flattened:
                if bar.close > self.range_high:
                    logger.info(f"🔔 Breakout detected! Close {bar.close:.2f} > Range High {self.range_high:.2f}")
                    
                    # Check SMA filter
                    if not self.sma10_above_sma30:
                        logger.info("❌ SMA filter FAILED - skipping trade")
                        await self._write_activity(
                            'breakout_skipped',
                            f"Close {bar.close:.2f} broke range high but SMA10 <= SMA30",
                            {'close': bar.close, 'range_high': self.range_high}
                        )
                        self.position_taken = True  # Don't retry this session
                        return
                    
                    # Check paperLive flag
                    paper_live = await self._check_paper_live_flag()
                    if not paper_live:
                        logger.info("❌ paperLive=false - skipping trade")
                        await self._write_activity(
                            'breakout_skipped',
                            f"Close {bar.close:.2f} broke range high but paperLive=false",
                            {'close': bar.close, 'range_high': self.range_high}
                        )
                        self.position_taken = True
                        return
                    
                    # Execute long
                    await self._go_long()
            
            # Flatten before close
            if self.position_taken and not self.flattened and self._should_flatten():
                await self._flatten()
                
        except Exception as e:
            logger.error(f"Error handling bar: {e}")
    
    async def _go_long(self):
        """Place long market order for SPY"""
        try:
            # Get account equity
            account = self.trading_client.get_account()
            equity = float(account.equity)
            
            # Calculate position size: 10% equity or $10k, whichever smaller
            max_notional = min(equity * 0.10, 10000)
            
            # Get current price and calculate shares
            current_price = float(account.last_equity)  # Approximate
            qty = int(max_notional / current_price)
            
            if qty < 1:
                logger.warning("Calculated qty < 1, skipping")
                return
            
            logger.info(f"📈 Going LONG {qty} shares SPY (notional ~${qty * current_price:.2f})")
            
            # Place market order
            order_request = MarketOrderRequest(
                symbol=self.symbol,
                qty=qty,
                side=OrderSide.BUY,
                time_in_force=TimeInForce.DAY,
                client_order_id=f"{self.order_prefix}long"
            )
            
            order = self.trading_client.submit_order(order_request)
            self.position_taken = True
            
            logger.info(f"✓ Order submitted: {order.id}")
            await self._write_activity(
                'position_opened',
                f"Long {qty} SPY @ market (order {order.id})",
                {'symbol': self.symbol, 'qty': qty, 'side': 'buy', 'order_id': str(order.id)}
            )
            
        except Exception as e:
            logger.error(f"Error going long: {e}")
            await self._write_activity(
                'error',
                f"Failed to open long position: {str(e)}",
                {'error': str(e)}
            )
    
    async def _flatten(self):
        """Close any open SPY position"""
        try:
            logger.info("🔻 Flattening position before close...")
            
            # Get current position
            try:
                position = self.trading_client.get_open_position(self.symbol)
                qty = abs(int(position.qty))
                
                logger.info(f"Closing {qty} shares SPY")
                
                # Place market sell
                order_request = MarketOrderRequest(
                    symbol=self.symbol,
                    qty=qty,
                    side=OrderSide.SELL,
                    time_in_force=TimeInForce.DAY,
                    client_order_id=f"{self.order_prefix}flatten"
                )
                
                order = self.trading_client.submit_order(order_request)
                self.flattened = True
                
                logger.info(f"✓ Flatten order submitted: {order.id}")
                await self._write_activity(
                    'position_closed',
                    f"Flattened {qty} SPY @ market (order {order.id})",
                    {'symbol': self.symbol, 'qty': qty, 'order_id': str(order.id)}
                )
                
            except Exception as e:
                if 'position does not exist' in str(e).lower():
                    logger.info("No position to flatten")
                else:
                    raise
                    
        except Exception as e:
            logger.error(f"Error flattening: {e}")
            await self._write_activity(
                'error',
                f"Failed to flatten position: {str(e)}",
                {'error': str(e)}
            )
    
    async def run(self):
        """Main run loop"""
        logger.info("=" * 60)
        logger.info("ORB SPY Bot Starting - PAPER ONLY")
        logger.info(f"Session: {self.session_date}")
        logger.info(f"Symbol: {self.symbol}")
        logger.info(f"Order prefix: {self.order_prefix}")
        logger.info("=" * 60)
        
        # Fetch SMA filter
        await self._fetch_sma_filter()
        
        # Subscribe to 1-minute bars
        logger.info(f"Subscribing to {self.symbol} 1-minute bars on SIP feed...")
        
        async def bar_handler(bar):
            await self._handle_bar(bar)
        
        self.stream.subscribe_bars(bar_handler, self.symbol)
        
        # Start streaming
        logger.info("Starting websocket stream...")
        await self._write_activity(
            'bot_started',
            f"ORB bot started for {self.symbol}",
            {'symbol': self.symbol, 'session': str(self.session_date)}
        )
        
        try:
            await self.stream._run_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            await self._write_activity(
                'bot_stopped',
                "ORB bot stopped by user",
                {}
            )
        except Exception as e:
            logger.error(f"Stream error: {e}")
            await self._write_activity(
                'error',
                f"Bot stopped due to error: {str(e)}",
                {'error': str(e)}
            )


async def main():
    """Entry point"""
    bot = ORBBot()
    await bot.run()


if __name__ == '__main__':
    asyncio.run(main())
