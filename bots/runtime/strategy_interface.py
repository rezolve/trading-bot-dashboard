"""
Strategy interface for trading bots.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class SignalType(Enum):
    """Signal types."""
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


@dataclass
class TradingSignal:
    """Trading signal."""
    signal_type: SignalType
    symbol: str
    quantity: Optional[float] = None
    confidence: float = 1.0
    metadata: Optional[Dict[str, Any]] = None


class StrategyInterface(ABC):
    """Base class for trading strategies."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize strategy.
        
        Args:
            config: Strategy configuration dict
        """
        self.config = config
        self.params = config.get('params', {})
    
    @abstractmethod
    def generate_signals(self, data: Any) -> List[TradingSignal]:
        """Generate trading signals based on market data.
        
        Args:
            data: Market data (pandas DataFrame or similar)
            
        Returns:
            List of trading signals
        """
        pass
    
    @abstractmethod
    def get_position_size(self, signal: TradingSignal, 
                         account_equity: float) -> float:
        """Calculate position size for a signal.
        
        Args:
            signal: Trading signal
            account_equity: Current account equity
            
        Returns:
            Position size (quantity)
        """
        pass
    
    def validate_config(self) -> bool:
        """Validate strategy configuration.
        
        Returns:
            True if valid
        """
        return True
    
    def get_required_data_period(self) -> int:
        """Get required historical data period in days.
        
        Returns:
            Number of days of historical data needed
        """
        return 60  # Default: 60 days
    
    def on_order_filled(self, order: Dict[str, Any]) -> None:
        """Callback when an order is filled.
        
        Args:
            order: Order details
        """
        pass
    
    def on_position_opened(self, position: Dict[str, Any]) -> None:
        """Callback when a position is opened.
        
        Args:
            position: Position details
        """
        pass
    
    def on_position_closed(self, position: Dict[str, Any]) -> None:
        """Callback when a position is closed.
        
        Args:
            position: Position details
        """
        pass
