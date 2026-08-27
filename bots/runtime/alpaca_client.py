"""
Alpaca API client with paper-only enforcement.
"""

import os
import sys
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame
    ALPACA_AVAILABLE = True
except ImportError:
    logger.warning("alpaca-py not installed. Backtest will use sample data.")
    ALPACA_AVAILABLE = False


def validate_paper_only() -> None:
    """Validate that only paper API endpoint is configured.
    
    Raises:
        ValueError: If live API endpoint is detected
    """
    base_url = os.getenv('APCA_API_BASE_URL', '')
    
    if not base_url:
        # Default to paper
        os.environ['APCA_API_BASE_URL'] = 'https://paper-api.alpaca.markets'
        logger.info("No APCA_API_BASE_URL set, defaulting to paper API")
        return
    
    if 'paper' not in base_url.lower():
        logger.critical(f"❌ LIVE API DETECTED: {base_url}")
        logger.critical("❌ This system only supports paper trading")
        logger.critical("❌ REFUSING TO START")
        raise ValueError("PAPER API endpoint required. Refusing to start with live API.")
    
    logger.info(f"✅ Paper-only check passed: {base_url}")


class AlpacaClient:
    """Alpaca API client wrapper with paper-only enforcement."""
    
    def __init__(self):
        """Initialize Alpaca client."""
        # Enforce paper-only BEFORE initializing client
        validate_paper_only()
        
        self.api_key = os.getenv('APCA_API_KEY_ID')
        self.api_secret = os.getenv('APCA_API_SECRET_KEY')
        
        if not self.api_key or not self.api_secret:
            logger.warning("Alpaca credentials not found. Running in demo mode.")
            self.trading_client = None
            self.data_client = None
            return
        
        if not ALPACA_AVAILABLE:
            logger.warning("alpaca-py not available. Running in demo mode.")
            self.trading_client = None
            self.data_client = None
            return
        
        try:
            self.trading_client = TradingClient(
                api_key=self.api_key,
                secret_key=self.api_secret,
                paper=True  # Force paper mode
            )
            
            self.data_client = StockHistoricalDataClient(
                api_key=self.api_key,
                secret_key=self.api_secret
            )
            
            logger.info("✅ Alpaca client initialized (PAPER MODE)")
        except Exception as e:
            logger.error(f"Error initializing Alpaca client: {e}")
            self.trading_client = None
            self.data_client = None
    
    def get_account(self) -> Optional[Dict[str, Any]]:
        """Get account information.
        
        Returns:
            Account dict or None if not available
        """
        if not self.trading_client:
            return None
        
        try:
            account = self.trading_client.get_account()
            return {
                'accountNumber': account.account_number,
                'equity': float(account.equity),
                'cash': float(account.cash),
                'buyingPower': float(account.buying_power),
                'patternDayTrader': account.pattern_day_trader,
            }
        except Exception as e:
            logger.error(f"Error getting account: {e}")
            return None
    
    def get_positions(self) -> List[Dict[str, Any]]:
        """Get all open positions.
        
        Returns:
            List of position dicts
        """
        if not self.trading_client:
            return []
        
        try:
            positions = self.trading_client.get_all_positions()
            return [
                {
                    'symbol': p.symbol,
                    'qty': float(p.qty),
                    'side': 'long' if float(p.qty) > 0 else 'short',
                    'avgEntryPrice': float(p.avg_entry_price),
                    'currentPrice': float(p.current_price),
                    'marketValue': float(p.market_value),
                    'costBasis': float(p.cost_basis),
                    'unrealizedPL': float(p.unrealized_pl),
                    'unrealizedPLPercent': float(p.unrealized_plpc) * 100,
                    'assetClass': 'stock',
                }
                for p in positions
            ]
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []
    
    def place_market_order(self, symbol: str, qty: float, side: str) -> Optional[str]:
        """Place a market order.
        
        Args:
            symbol: Stock symbol
            qty: Quantity
            side: 'buy' or 'sell'
            
        Returns:
            Order ID or None if failed
        """
        if not self.trading_client:
            logger.warning("Trading client not available")
            return None
        
        try:
            order_side = OrderSide.BUY if side.lower() == 'buy' else OrderSide.SELL
            
            request = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY
            )
            
            order = self.trading_client.submit_order(request)
            logger.info(f"Order placed: {side} {qty} {symbol} (ID: {order.id})")
            return order.id
        except Exception as e:
            logger.error(f"Error placing order: {e}")
            return None
    
    def get_historical_bars(self, symbol: str, start_date: datetime, 
                           end_date: datetime, timeframe: str = '1Day') -> Optional[Any]:
        """Get historical bar data.
        
        Args:
            symbol: Stock symbol
            start_date: Start date
            end_date: End date
            timeframe: Timeframe (e.g., '1Day', '1Hour')
            
        Returns:
            Bars dataframe or None if failed
        """
        if not self.data_client:
            logger.warning("Data client not available, returning sample data")
            return self._get_sample_bars(symbol, start_date, end_date)
        
        try:
            # Map timeframe string to TimeFrame enum
            tf_map = {
                '1Min': TimeFrame.Minute,
                '5Min': TimeFrame(5, 'Minute'),
                '15Min': TimeFrame(15, 'Minute'),
                '1Hour': TimeFrame.Hour,
                '1Day': TimeFrame.Day,
            }
            
            tf = tf_map.get(timeframe, TimeFrame.Day)
            
            request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=tf,
                start=start_date,
                end=end_date
            )
            
            bars = self.data_client.get_stock_bars(request)
            return bars.df
        except Exception as e:
            logger.error(f"Error getting historical bars: {e}")
            return self._get_sample_bars(symbol, start_date, end_date)
    
    def _get_sample_bars(self, symbol: str, start_date: datetime, 
                        end_date: datetime) -> Any:
        """Generate sample bar data for testing.
        
        Args:
            symbol: Stock symbol
            start_date: Start date
            end_date: End date
            
        Returns:
            Sample bars dataframe
        """
        try:
            import pandas as pd
            import numpy as np
            
            # Generate sample data
            dates = pd.date_range(start=start_date, end=end_date, freq='D')
            
            # Simulate price movement
            base_price = 100.0
            returns = np.random.normal(0.001, 0.02, len(dates))
            prices = base_price * np.exp(np.cumsum(returns))
            
            df = pd.DataFrame({
                'open': prices * (1 + np.random.uniform(-0.01, 0.01, len(dates))),
                'high': prices * (1 + np.random.uniform(0, 0.02, len(dates))),
                'low': prices * (1 + np.random.uniform(-0.02, 0, len(dates))),
                'close': prices,
                'volume': np.random.randint(1000000, 10000000, len(dates)),
            }, index=dates)
            
            logger.warning(f"⚠️ USING SAMPLE DATA for {symbol} (Alpaca not available)")
            return df
        except Exception as e:
            logger.error(f"Error generating sample data: {e}")
            return None
