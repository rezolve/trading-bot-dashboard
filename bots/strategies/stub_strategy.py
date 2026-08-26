"""
Stub strategy for testing and template purposes.
This strategy does not generate any actual trading signals.
"""

import logging
from typing import List, Any, Dict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'runtime'))

from strategy_interface import StrategyInterface, TradingSignal, SignalType

logger = logging.getLogger(__name__)


class StubStrategy(StrategyInterface):
    """Stub strategy that generates no signals."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize strategy.
        
        Args:
            config: Strategy configuration
        """
        super().__init__(config)
        logger.info("Stub Strategy initialized (does nothing)")
    
    def generate_signals(self, data: Any) -> List[TradingSignal]:
        """Generate trading signals.
        
        This stub implementation never generates signals.
        
        Args:
            data: Historical price data (ignored)
            
        Returns:
            Empty list
        """
        logger.debug("Stub strategy: no signals generated")
        return []
    
    def get_position_size(self, signal: TradingSignal, account_equity: float) -> float:
        """Calculate position size.
        
        Args:
            signal: Trading signal
            account_equity: Current account equity
            
        Returns:
            Always returns 0
        """
        return 0.0
    
    def validate_config(self) -> bool:
        """Validate configuration.
        
        Returns:
            Always returns True
        """
        return True
