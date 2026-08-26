"""
Simple Moving Average (SMA) Crossover Strategy.

Generates BUY signal when fast SMA crosses above slow SMA.
Generates SELL signal when fast SMA crosses below slow SMA.
"""

import logging
from typing import List, Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'runtime'))

from strategy_interface import StrategyInterface, TradingSignal, SignalType

logger = logging.getLogger(__name__)


class SMAcrossoverStrategy(StrategyInterface):
    """SMA Crossover trading strategy."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize strategy.
        
        Args:
            config: Strategy configuration
                - fast_period: Fast SMA period (default: 10)
                - slow_period: Slow SMA period (default: 30)
                - symbol: Trading symbol (default: SPY)
        """
        super().__init__(config)
        
        self.fast_period = self.params.get('fast_period', 10)
        self.slow_period = self.params.get('slow_period', 30)
        self.symbol = self.params.get('symbol', 'SPY')
        
        # State
        self.last_signal = None
        
        logger.info(f"SMA Crossover Strategy initialized: "
                   f"fast={self.fast_period}, slow={self.slow_period}, symbol={self.symbol}")
    
    def generate_signals(self, data: Any) -> List[TradingSignal]:
        """Generate trading signals.
        
        Args:
            data: Historical price data (pandas DataFrame with OHLCV)
            
        Returns:
            List of trading signals
        """
        if data is None or len(data) < self.slow_period:
            logger.debug("Insufficient data for signal generation")
            return []
        
        try:
            import pandas as pd
            
            # Calculate SMAs
            fast_sma = data['close'].rolling(window=self.fast_period).mean()
            slow_sma = data['close'].rolling(window=self.slow_period).mean()
            
            # Get latest values
            current_fast = fast_sma.iloc[-1]
            current_slow = slow_sma.iloc[-1]
            prev_fast = fast_sma.iloc[-2] if len(fast_sma) > 1 else None
            prev_slow = slow_sma.iloc[-2] if len(slow_sma) > 1 else None
            
            if pd.isna(current_fast) or pd.isna(current_slow):
                return []
            
            if prev_fast is None or prev_slow is None:
                return []
            
            signals = []
            
            # Bullish crossover: fast crosses above slow
            if prev_fast <= prev_slow and current_fast > current_slow:
                if self.last_signal != 'buy':
                    logger.info(f"BUY signal: Fast SMA ({current_fast:.2f}) crossed above "
                               f"Slow SMA ({current_slow:.2f})")
                    signals.append(TradingSignal(
                        signal_type=SignalType.BUY,
                        symbol=self.symbol,
                        confidence=self._calculate_confidence(current_fast, current_slow),
                        metadata={
                            'fast_sma': current_fast,
                            'slow_sma': current_slow,
                            'crossover': 'bullish'
                        }
                    ))
                    self.last_signal = 'buy'
            
            # Bearish crossover: fast crosses below slow
            elif prev_fast >= prev_slow and current_fast < current_slow:
                if self.last_signal != 'sell':
                    logger.info(f"SELL signal: Fast SMA ({current_fast:.2f}) crossed below "
                               f"Slow SMA ({current_slow:.2f})")
                    signals.append(TradingSignal(
                        signal_type=SignalType.SELL,
                        symbol=self.symbol,
                        confidence=self._calculate_confidence(current_fast, current_slow),
                        metadata={
                            'fast_sma': current_fast,
                            'slow_sma': current_slow,
                            'crossover': 'bearish'
                        }
                    ))
                    self.last_signal = 'sell'
            
            return signals
        
        except Exception as e:
            logger.error(f"Error generating signals: {e}")
            return []
    
    def get_position_size(self, signal: TradingSignal, account_equity: float) -> float:
        """Calculate position size.
        
        Uses fixed percentage of equity (20% by default).
        
        Args:
            signal: Trading signal
            account_equity: Current account equity
            
        Returns:
            Position size in shares
        """
        position_pct = self.params.get('position_size_pct', 0.20)  # 20% of equity
        notional = account_equity * position_pct
        
        # Estimate shares (simplified - would need current price in production)
        estimated_price = 100.0  # Placeholder
        shares = int(notional / estimated_price)
        
        logger.debug(f"Position size calculated: {shares} shares "
                    f"({position_pct*100:.0f}% of ${account_equity:.2f})")
        
        return shares
    
    def get_required_data_period(self) -> int:
        """Get required data period.
        
        Returns:
            Number of days needed (slow period + buffer)
        """
        return self.slow_period + 10
    
    def validate_config(self) -> bool:
        """Validate strategy configuration.
        
        Returns:
            True if valid
        """
        if self.fast_period >= self.slow_period:
            logger.error("Fast period must be less than slow period")
            return False
        
        if self.fast_period < 1 or self.slow_period < 1:
            logger.error("Periods must be positive integers")
            return False
        
        return True
    
    def _calculate_confidence(self, fast_sma: float, slow_sma: float) -> float:
        """Calculate signal confidence based on SMA divergence.
        
        Args:
            fast_sma: Fast SMA value
            slow_sma: Slow SMA value
            
        Returns:
            Confidence score (0.0 to 1.0)
        """
        # Higher divergence = higher confidence
        divergence = abs(fast_sma - slow_sma) / slow_sma
        confidence = min(1.0, divergence * 10)  # Scale to 0-1
        return confidence
