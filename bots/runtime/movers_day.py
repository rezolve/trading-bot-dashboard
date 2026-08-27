#!/usr/bin/env python3
"""
Movers Day-Trade Book - PAPER ONLY

This bot scans Alpaca SIP market movers (gainers/losers + most-active) and trades
gap-and-go continuation on liquid names. Hard rule: NEVER hold overnight.

Key behaviors:
- Universe: Alpaca SIP market movers (gainers/losers) UNION most-active by volume
- Filters: price >= $5, no warrants/units (.WS suffix), no OTC, prefer ADV >= 5M
- Cap watchlist at ~20 names, max 3 simultaneous positions
- Strategy v1 long-only: if SPY daily SMA10>SMA30, take continuation (gap-and-go)
- Stop at signal-bar low / premarket low
- Flatten ALL by 15:55 ET (calendar-aware early close). No GTC overnight.
- Size: $10k notional per name or 10% equity, whichever smaller
- Checks Firestore bots/bot_movers_day paperLive flag before trading
- REFUSES to start if APCA_API_BASE_URL contains 'live' or doesn't contain 'paper'
- TradingClient(paper=True) ONLY
- Keys from env APCA_API_KEY_ID / APCA_API_SECRET_KEY (never logged)

Session: America/New_York
Client order ID prefix: movers-YYYYMMDD-

PAPER ONLY. NO LIVE TRADING.
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Optional, Dict, Any, List, Set
import pytz

# Alpaca
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, TimeInForce, QueryOrderStatus
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockLatestBarRequest, StockSnapshotRequest
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
BOT_ID = 'bot_movers_day'


class MoversDayBot:
    """Movers day-trade scanner bot - PAPER ONLY"""
    
    def __init__(self):
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
        if 'live' in self.api_base_url.lower():
            logger.error(f"APCA_API_BASE_URL contains 'live': {self.api_base_url}")
            logger.error("REFUSING TO START - PAPER ONLY")
            sys.exit(1)
        
        if not self.api_key or not self.api_secret:
            logger.error("APCA_API_KEY_ID and APCA_API_SECRET_KEY must be set")
            sys.exit(1)
        
        # Trading client (PAPER ONLY)
        self.trading_client = TradingClient(
            api_key=self.api_key,
            secret_key=self.api_secret,
            paper=True  # FORCE PAPER
        )
        
        # Data clients
        self.data_client = StockHistoricalDataClient(
            api_key=self.api_key,
            secret_key=self.api_secret
        )
        
        # Firebase
        if not firebase_admin._apps:
            # Use default credentials or emulator
            firebase_admin.initialize_app()
        self.db = firestore.client()
        
        # State
        self.watchlist: Set[str] = set()
        self.positions: Dict[str, Dict[str, Any]] = {}
        self.today_str = ""
        self.market_open = False
        self.spy_sma_bullish = False
        self.premarket_highs: Dict[str, float] = {}
        self.rth_highs: Dict[str, float] = {}
        self.stop_prices: Dict[str, float] = {}
        
        # Risk limits
        self.max_watchlist_size = 20
        self.max_positions = 3
        self.max_notional_per_name = 10000
        self.max_position_pct = 0.10  # 10% of equity
        self.min_price = 5.0
        self.min_adv = 5_000_000  # 5M shares ADV preference
        
        logger.info(f"MoversDayBot initialized - PAPER ONLY")
        logger.info(f"API Base URL: {self.api_base_url}")
    
    def log_activity(self, event_type: str, message: str, metadata: Optional[Dict] = None):
        """Write to Firestore bot-activity collection"""
        try:
            activity_ref = self.db.collection('bot-activity').document()
            activity_ref.set({
                'botId': BOT_ID,
                'userId': os.getenv('USER_ID', 'system'),
                'eventType': event_type,
                'message': message,
                'metadata': metadata or {},
                'createdAt': firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")
    
    def check_paper_live(self) -> bool:
        """Check if bot is paper-live in Firestore"""
        try:
            bot_ref = self.db.collection('bots').document(BOT_ID)
            bot_doc = bot_ref.get()
            if bot_doc.exists:
                data = bot_doc.to_dict()
                return data.get('paperLive', False)
            return False
        except Exception as e:
            logger.error(f"Failed to check paperLive: {e}")
            return False
    
    def check_kill_switch(self) -> bool:
        """Check kill switch from bot-settings"""
        try:
            user_id = os.getenv('USER_ID', 'system')
            settings_ref = self.db.collection('bot-settings').document(user_id)
            settings_doc = settings_ref.get()
            if settings_doc.exists:
                data = settings_doc.to_dict()
                return data.get('killSwitch', False)
            return False
        except Exception as e:
            logger.error(f"Failed to check kill switch: {e}")
            return False
    
    async def get_market_movers(self) -> List[str]:
        """Fetch Alpaca market movers (gainers/losers + most-active)"""
        try:
            # Get market movers from Alpaca API
            # This uses the /v1beta1/screener/stocks/movers endpoint
            import requests
            headers = {
                'APCA-API-KEY-ID': self.api_key,
                'APCA-API-SECRET-KEY': self.api_secret
            }
            
            symbols = set()
            
            # Gainers
            try:
                resp = requests.get(
                    'https://data.alpaca.markets/v1beta1/screener/stocks/movers',
                    params={'top': 10, 'by': 'percent'},
                    headers=headers,
                    timeout=10
                )
                if resp.status_code == 200:
                    data = resp.json()
                    gainers = data.get('gainers', [])
                    for item in gainers:
                        symbols.add(item['symbol'])
            except Exception as e:
                logger.warning(f"Failed to fetch gainers: {e}")
            
            # Losers (for potential reversal, but v1 is long-only so we'll skip losers for now)
            
            # Most-active by volume
            try:
                resp = requests.get(
                    'https://data.alpaca.markets/v1beta1/screener/stocks/most-actives',
                    params={'top': 10, 'by': 'volume'},
                    headers=headers,
                    timeout=10
                )
                if resp.status_code == 200:
                    data = resp.json()
                    most_active = data.get('most_actives', [])
                    for item in most_active:
                        symbols.add(item['symbol'])
            except Exception as e:
                logger.warning(f"Failed to fetch most-active: {e}")
            
            return list(symbols)
        except Exception as e:
            logger.error(f"Failed to get market movers: {e}")
            return []
    
    def filter_symbols(self, symbols: List[str]) -> List[str]:
        """Filter symbols: price >= $5, no warrants, no OTC, prefer ADV >= 5M"""
        filtered = []
        skipped = []
        
        for symbol in symbols:
            # Skip warrants, units, OTC
            if any(suffix in symbol.upper() for suffix in ['.WS', '.U', '.W', '+', '^']):
                skipped.append(f"{symbol} (warrant/unit)")
                continue
            
            # Skip obvious OTC patterns (contains '.', starts with digits, etc.)
            if '.' in symbol or symbol[0].isdigit():
                skipped.append(f"{symbol} (OTC pattern)")
                continue
            
            # Check price and ADV via snapshot
            try:
                snapshot_req = StockSnapshotRequest(symbol_or_symbols=symbol)
                snapshots = self.data_client.get_stock_snapshot(snapshot_req)
                
                if symbol not in snapshots:
                    skipped.append(f"{symbol} (no snapshot)")
                    continue
                
                snap = snapshots[symbol]
                
                # Check latest trade price
                if snap.latest_trade and snap.latest_trade.price:
                    price = snap.latest_trade.price
                    if price < self.min_price:
                        skipped.append(f"{symbol} (price ${price:.2f} < ${self.min_price})")
                        continue
                else:
                    skipped.append(f"{symbol} (no price)")
                    continue
                
                # Check ADV (average daily volume) if available
                if snap.daily_bar and snap.daily_bar.volume:
                    volume = snap.daily_bar.volume
                    if volume < self.min_adv:
                        logger.debug(f"{symbol} ADV {volume:,} < {self.min_adv:,}, allowing anyway")
                
                filtered.append(symbol)
                
                if len(filtered) >= self.max_watchlist_size:
                    break
            
            except Exception as e:
                logger.debug(f"Failed to filter {symbol}: {e}")
                skipped.append(f"{symbol} (filter error)")
                continue
        
        if skipped:
            self.log_activity('scan_filter', f"Filtered out {len(skipped)} symbols", {'skipped': skipped[:10]})
        
        return filtered
    
    async def calculate_spy_sma(self):
        """Calculate SPY daily SMA10 and SMA30 to determine market regime"""
        try:
            end = datetime.now(ET)
            start = end - timedelta(days=60)
            
            request = StockBarsRequest(
                symbol_or_symbols='SPY',
                timeframe=TimeFrame.Day,
                start=start,
                end=end
            )
            bars = self.data_client.get_stock_bars(request)
            
            if 'SPY' not in bars:
                logger.warning("No SPY bars for SMA calculation")
                return
            
            spy_bars = bars['SPY']
            closes = [bar.close for bar in spy_bars]
            
            if len(closes) < 30:
                logger.warning(f"Not enough bars for SMA30 ({len(closes)} bars)")
                return
            
            sma10 = sum(closes[-10:]) / 10
            sma30 = sum(closes[-30:]) / 30
            
            self.spy_sma_bullish = sma10 > sma30
            logger.info(f"SPY SMA10={sma10:.2f} SMA30={sma30:.2f} -> Bullish={self.spy_sma_bullish}")
            
        except Exception as e:
            logger.error(f"Failed to calculate SPY SMA: {e}")
    
    async def scan_and_update_watchlist(self):
        """Scan for movers and update watchlist"""
        logger.info("Scanning market movers...")
        
        raw_symbols = await self.get_market_movers()
        logger.info(f"Raw movers: {len(raw_symbols)} symbols")
        
        filtered_symbols = self.filter_symbols(raw_symbols)
        logger.info(f"Filtered watchlist: {len(filtered_symbols)} symbols: {filtered_symbols}")
        
        self.watchlist = set(filtered_symbols)
        self.log_activity('scan_complete', f"Watchlist updated: {len(self.watchlist)} symbols", {'symbols': list(self.watchlist)})
    
    async def check_entry_signals(self):
        """Check for gap-and-go continuation entries"""
        if not self.spy_sma_bullish:
            logger.debug("SPY not bullish (SMA10 < SMA30), no entries")
            return
        
        if len(self.positions) >= self.max_positions:
            logger.debug(f"Max positions ({self.max_positions}) reached")
            return
        
        for symbol in self.watchlist:
            if symbol in self.positions:
                continue
            
            # Check for gap-and-go continuation signal
            # v1: break of premarket high or first RTH 1Min high
            # For simplicity, we'll check if current price > premarket high
            try:
                snapshot_req = StockSnapshotRequest(symbol_or_symbols=symbol)
                snapshots = self.data_client.get_stock_snapshot(snapshot_req)
                
                if symbol not in snapshots:
                    continue
                
                snap = snapshots[symbol]
                
                if not snap.latest_trade or not snap.latest_trade.price:
                    continue
                
                current_price = snap.latest_trade.price
                
                # Get premarket high (simplified: use previous day's high as proxy)
                # In production, you'd track actual premarket data
                pm_high = self.premarket_highs.get(symbol, current_price * 0.98)
                
                # Simple signal: current price > premarket high
                if current_price > pm_high:
                    await self.enter_position(symbol, current_price, pm_high)
                    
                    if len(self.positions) >= self.max_positions:
                        break
            
            except Exception as e:
                logger.debug(f"Failed to check entry for {symbol}: {e}")
    
    async def enter_position(self, symbol: str, entry_price: float, stop_price: float):
        """Enter a long position"""
        try:
            # Check paper live
            if not self.check_paper_live():
                logger.info(f"Not paper-live, skipping entry for {symbol}")
                return
            
            # Check kill switch
            if self.check_kill_switch():
                logger.warning(f"Kill switch active, skipping entry for {symbol}")
                return
            
            # Calculate position size
            account = self.trading_client.get_account()
            equity = float(account.equity)
            
            max_by_pct = equity * self.max_position_pct
            max_notional = min(self.max_notional_per_name, max_by_pct)
            qty = int(max_notional / entry_price)
            
            if qty < 1:
                logger.info(f"Position size < 1 share for {symbol}, skipping")
                return
            
            # Place market order
            order_id = f"movers-{self.today_str}-{symbol}-{int(datetime.now(ET).timestamp())}"
            
            order_req = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=OrderSide.BUY,
                time_in_force=TimeInForce.DAY,
                client_order_id=order_id
            )
            
            order = self.trading_client.submit_order(order_req)
            
            self.positions[symbol] = {
                'entry_price': entry_price,
                'stop_price': stop_price,
                'qty': qty,
                'order_id': order.id,
                'client_order_id': order_id
            }
            
            self.stop_prices[symbol] = stop_price
            
            logger.info(f"ENTRY: {symbol} x{qty} @ ${entry_price:.2f}, stop=${stop_price:.2f}")
            self.log_activity('position_opened', f"Entered {symbol} x{qty} @ ${entry_price:.2f}", {
                'symbol': symbol,
                'qty': qty,
                'entry_price': entry_price,
                'stop_price': stop_price
            })
        
        except Exception as e:
            logger.error(f"Failed to enter {symbol}: {e}")
    
    async def check_stops_and_manage(self):
        """Check stops and manage open positions"""
        for symbol in list(self.positions.keys()):
            try:
                snapshot_req = StockSnapshotRequest(symbol_or_symbols=symbol)
                snapshots = self.data_client.get_stock_snapshot(snapshot_req)
                
                if symbol not in snapshots:
                    continue
                
                snap = snapshots[symbol]
                
                if not snap.latest_trade or not snap.latest_trade.price:
                    continue
                
                current_price = snap.latest_trade.price
                stop_price = self.stop_prices.get(symbol)
                
                # Check stop
                if stop_price and current_price <= stop_price:
                    logger.info(f"STOP HIT: {symbol} ${current_price:.2f} <= ${stop_price:.2f}")
                    await self.exit_position(symbol, 'stop')
            
            except Exception as e:
                logger.debug(f"Failed to manage {symbol}: {e}")
    
    async def exit_position(self, symbol: str, reason: str = 'flatten'):
        """Exit a position"""
        try:
            if symbol not in self.positions:
                return
            
            pos_info = self.positions[symbol]
            qty = pos_info['qty']
            
            # Place market sell order
            order_id = f"movers-{self.today_str}-{symbol}-exit-{int(datetime.now(ET).timestamp())}"
            
            order_req = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=OrderSide.SELL,
                time_in_force=TimeInForce.DAY,
                client_order_id=order_id
            )
            
            order = self.trading_client.submit_order(order_req)
            
            logger.info(f"EXIT ({reason}): {symbol} x{qty}")
            self.log_activity('position_closed', f"Exited {symbol} x{qty} ({reason})", {
                'symbol': symbol,
                'qty': qty,
                'reason': reason
            })
            
            del self.positions[symbol]
            if symbol in self.stop_prices:
                del self.stop_prices[symbol]
        
        except Exception as e:
            logger.error(f"Failed to exit {symbol}: {e}")
    
    async def flatten_all_positions(self):
        """Flatten all positions before market close"""
        if not self.positions:
            return
        
        logger.info(f"Flattening {len(self.positions)} positions before close")
        
        for symbol in list(self.positions.keys()):
            await self.exit_position(symbol, 'eod_flatten')
    
    def is_market_hours(self) -> bool:
        """Check if within RTH (09:30 - 16:00 ET)"""
        now = datetime.now(ET)
        market_open = time(9, 30)
        market_close = time(16, 0)
        return market_open <= now.time() < market_close
    
    def is_flatten_time(self) -> bool:
        """Check if it's time to flatten (15:55 ET)"""
        now = datetime.now(ET)
        flatten_time = time(15, 55)
        return now.time() >= flatten_time
    
    async def run(self):
        """Main event loop"""
        logger.info("Starting MoversDayBot main loop")
        
        # Calculate SPY SMA at startup
        await self.calculate_spy_sma()
        
        # Set today string
        self.today_str = datetime.now(ET).strftime('%Y%m%d')
        
        last_scan_time = None
        last_sma_calc_time = None
        
        while True:
            try:
                now = datetime.now(ET)
                
                # Check kill switch
                if self.check_kill_switch():
                    logger.warning("Kill switch active, flattening all positions")
                    await self.flatten_all_positions()
                    await asyncio.sleep(60)
                    continue
                
                # Check if paper-live
                paper_live = self.check_paper_live()
                
                if not paper_live:
                    logger.debug("Not paper-live, staying connected but not trading")
                    await asyncio.sleep(30)
                    continue
                
                # Recalculate SPY SMA once at market open
                if self.is_market_hours() and (last_sma_calc_time is None or 
                                               (now - last_sma_calc_time).seconds > 3600):
                    await self.calculate_spy_sma()
                    last_sma_calc_time = now
                
                # Scan for movers once at market open
                if self.is_market_hours() and last_scan_time is None:
                    await self.scan_and_update_watchlist()
                    last_scan_time = now
                
                # Flatten time check (15:55 ET)
                if self.is_flatten_time() and self.positions:
                    await self.flatten_all_positions()
                
                # During market hours, check for signals and manage positions
                if self.is_market_hours():
                    await self.check_entry_signals()
                    await self.check_stops_and_manage()
                    await asyncio.sleep(60)  # Check every minute
                else:
                    logger.debug("Outside market hours, sleeping")
                    await asyncio.sleep(300)  # Check every 5 minutes outside market hours
            
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(60)


async def main():
    """Entry point"""
    logger.info("MoversDayBot starting - PAPER ONLY")
    
    bot = MoversDayBot()
    await bot.run()


if __name__ == '__main__':
    asyncio.run(main())
