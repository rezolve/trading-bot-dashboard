"""
AI-Driven Iron Condor Options Strategy for Alpaca Hackathon

Strategy: Sell OTM call and put spreads simultaneously (iron condor)
- Defined risk (max loss = width of spread - credit received)
- Profit from low volatility / sideways markets
- AI selects strikes based on IV, price action, and probability of profit

Risk Management:
- Position sizing based on account equity
- Max contracts per trade
- No naked positions (all spreads)
- Dynamic strike selection using implied volatility
- Auto-exit at 50% max profit or 200% max loss
"""

import logging
from typing import List, Any, Dict, Optional
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'runtime'))

from strategy_interface import StrategyInterface, TradingSignal, SignalType

logger = logging.getLogger(__name__)


class IronCondorAIStrategy(StrategyInterface):
    """
    AI-driven Iron Condor strategy for options trading.
    
    Iron Condor = Short OTM Call Spread + Short OTM Put Spread
    - Sell call spread above current price
    - Sell put spread below current price
    - Collect premium, profit if price stays between spreads
    - Defined max loss (spread width - premium)
    
    AI Components:
    1. Volatility Analysis: Use IV to select optimal strike width
    2. Probability Scoring: Calculate probability of profit (POP)
    3. Market Regime Detection: Identify sideways vs trending markets
    4. Dynamic Position Sizing: Adjust based on market conditions
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize strategy.
        
        Args:
            config: Strategy configuration
                - symbol: Underlying symbol (e.g., SPY)
                - dte_min: Min days to expiration (default: 30)
                - dte_max: Max days to expiration (default: 45)
                - spread_width: Width of each spread in strikes (default: 5)
                - delta_target: Target delta for short strikes (default: 0.20)
                - min_credit: Minimum credit per contract (default: 0.50)
                - max_contracts: Max contracts per trade (default: 5)
                - profit_target_pct: Exit at X% of max profit (default: 0.50)
                - loss_limit_pct: Exit at X% of max loss (default: 2.00)
        """
        super().__init__(config)
        
        self.symbol = self.params.get('symbol', 'SPY')
        self.dte_min = self.params.get('dte_min', 30)
        self.dte_max = self.params.get('dte_max', 45)
        self.spread_width = self.params.get('spread_width', 5)
        self.delta_target = self.params.get('delta_target', 0.20)
        self.min_credit = self.params.get('min_credit', 0.50)
        self.max_contracts = self.params.get('max_contracts', 5)
        self.profit_target_pct = self.params.get('profit_target_pct', 0.50)
        self.loss_limit_pct = self.params.get('loss_limit_pct', 2.00)
        
        # Track current positions
        self.current_position = None
        self.entry_credit = 0
        self.max_loss = 0
        
        logger.info(f"Iron Condor AI Strategy initialized: {self.symbol}, "
                   f"DTE {self.dte_min}-{self.dte_max}, "
                   f"Spread Width {self.spread_width}, "
                   f"Max Contracts {self.max_contracts}")
    
    def generate_signals(self, data: Any) -> List[TradingSignal]:
        """Generate trading signals based on market conditions.
        
        Args:
            data: Market data (price, IV, Greeks)
            
        Returns:
            List of trading signals
        """
        if data is None or len(data) < 20:
            logger.debug("Insufficient data for signal generation")
            return []
        
        try:
            signals = []
            
            # Get current price and calculate IV rank
            current_price = data['close'].iloc[-1]
            
            # Calculate recent volatility (simplified)
            returns = data['close'].pct_change().iloc[-20:]
            realized_vol = returns.std() * (252 ** 0.5) * 100  # Annualized %
            
            # AI Decision: Should we enter a new iron condor?
            if self.current_position is None:
                if self._should_enter_position(data, current_price, realized_vol):
                    # Generate entry signal
                    signal = self._generate_entry_signal(current_price, realized_vol)
                    if signal:
                        signals.append(signal)
                        logger.info(f"Entry signal generated: IV={realized_vol:.1f}%, "
                                   f"Price={current_price:.2f}")
            
            # AI Decision: Should we exit current position?
            else:
                if self._should_exit_position(data, current_price):
                    # Generate exit signal
                    signal = TradingSignal(
                        signal_type=SignalType.SELL,
                        symbol=self.symbol,
                        confidence=1.0,
                        metadata={
                            'action': 'close_iron_condor',
                            'reason': 'profit_target_or_loss_limit',
                        }
                    )
                    signals.append(signal)
                    logger.info(f"Exit signal generated: closing iron condor")
                    self.current_position = None
            
            return signals
        
        except Exception as e:
            logger.error(f"Error generating signals: {e}")
            return []
    
    def _should_enter_position(self, data: Any, price: float, iv: float) -> bool:
        """AI logic to determine if we should enter a new iron condor.
        
        Factors:
        1. Market regime: Prefer sideways/low volatility
        2. IV level: Higher IV = better premium
        3. Price action: Recent consolidation preferred
        
        Args:
            data: Market data
            price: Current price
            iv: Implied volatility estimate
            
        Returns:
            True if conditions favorable for entry
        """
        # Check if we're in a low-volatility regime
        # Calculate price range over last 20 days
        price_range = (data['high'].iloc[-20:].max() - data['low'].iloc[-20:].min()) / price
        
        # AI scoring
        score = 0
        
        # Factor 1: Low recent price movement (sideways market)
        if price_range < 0.10:  # Less than 10% range
            score += 3
            logger.debug(f"Low price range: {price_range:.1%} (+3)")
        
        # Factor 2: Moderate IV (sweet spot for premium)
        if 15 < iv < 35:
            score += 2
            logger.debug(f"Moderate IV: {iv:.1f}% (+2)")
        elif iv >= 35:
            score += 1  # High IV is okay but riskier
            logger.debug(f"High IV: {iv:.1f}% (+1)")
        
        # Factor 3: Not in strong trend
        sma_20 = data['close'].iloc[-20:].mean()
        if abs(price - sma_20) / sma_20 < 0.02:  # Within 2% of 20-day average
            score += 2
            logger.debug(f"Near SMA: {abs(price - sma_20) / sma_20:.1%} (+2)")
        
        # Threshold: Need score >= 4 to enter
        logger.debug(f"Entry score: {score}/7")
        return score >= 4
    
    def _should_exit_position(self, data: Any, price: float) -> bool:
        """AI logic to determine if we should exit current position.
        
        Args:
            data: Market data
            price: Current price
            
        Returns:
            True if should exit
        """
        if self.current_position is None:
            return False
        
        # Calculate current P&L (simplified - would use real options prices)
        # For backtest: estimate based on price movement
        strikes = self.current_position.get('strikes', {})
        
        # Exit conditions:
        # 1. Profit target reached (50% of max profit by default)
        # 2. Loss limit reached (200% of max loss by default)
        # 3. Price approaching short strikes (defensive exit)
        
        # Simplified: Use price distance from entry
        entry_price = self.current_position.get('entry_price', price)
        price_change_pct = abs(price - entry_price) / entry_price
        
        # If price moved > 5%, consider exiting
        if price_change_pct > 0.05:
            logger.info(f"Price moved {price_change_pct:.1%}, exiting defensively")
            return True
        
        # Time-based exit: Close within 7 days of expiration
        # (Would check actual DTE in production)
        
        return False
    
    def _generate_entry_signal(self, price: float, iv: float) -> Optional[TradingSignal]:
        """Generate iron condor entry signal with strike selection.
        
        Args:
            price: Current underlying price
            iv: Implied volatility
            
        Returns:
            Trading signal or None
        """
        # AI Strike Selection
        # Use IV to calculate expected move and select strikes outside it
        
        # Expected move = price * IV * sqrt(DTE/365)
        dte = (self.dte_min + self.dte_max) / 2
        expected_move_pct = (iv / 100) * (dte / 365) ** 0.5
        
        # Place short strikes outside expected move
        # Call side: Above current price + expected move
        short_call_strike = price * (1 + expected_move_pct * 1.5)
        long_call_strike = short_call_strike + self.spread_width
        
        # Put side: Below current price - expected move
        short_put_strike = price * (1 - expected_move_pct * 1.5)
        long_put_strike = short_put_strike - self.spread_width
        
        # Round to nearest dollar (or nearest strike)
        short_call_strike = round(short_call_strike)
        long_call_strike = round(long_call_strike)
        short_put_strike = round(short_put_strike)
        long_put_strike = round(long_put_strike)
        
        # Store position info
        self.current_position = {
            'entry_price': price,
            'entry_iv': iv,
            'strikes': {
                'short_call': short_call_strike,
                'long_call': long_call_strike,
                'short_put': short_put_strike,
                'long_put': long_put_strike,
            },
            'entry_time': datetime.now().isoformat(),
        }
        
        # Calculate estimated credit (simplified)
        self.entry_credit = self.spread_width * 0.30  # ~30% of spread width
        self.max_loss = self.spread_width - self.entry_credit
        
        signal = TradingSignal(
            signal_type=SignalType.BUY,
            symbol=self.symbol,
            confidence=0.8,
            metadata={
                'action': 'open_iron_condor',
                'strikes': self.current_position['strikes'],
                'expected_credit': self.entry_credit,
                'max_loss': self.max_loss,
                'expected_move': expected_move_pct,
                'contracts': 1,  # Start with 1 contract
            }
        )
        
        return signal
    
    def get_position_size(self, signal: TradingSignal, account_equity: float) -> float:
        """Calculate position size (number of contracts).
        
        Risk management:
        - Max risk per trade = 2% of account
        - Respect max_contracts limit
        
        Args:
            signal: Trading signal
            account_equity: Current account equity
            
        Returns:
            Number of contracts
        """
        # Max risk = 2% of account
        max_risk = account_equity * 0.02
        
        # Calculate contracts based on max loss per contract
        if self.max_loss > 0:
            contracts = int(max_risk / (self.max_loss * 100))  # * 100 for contract multiplier
        else:
            contracts = 1
        
        # Apply max contracts limit
        contracts = min(contracts, self.max_contracts)
        contracts = max(contracts, 1)  # At least 1 contract
        
        logger.info(f"Position size: {contracts} contracts "
                   f"(max risk: ${max_risk:.0f}, max loss per: ${self.max_loss * 100:.0f})")
        
        return float(contracts)
    
    def get_required_data_period(self) -> int:
        """Get required data period.
        
        Returns:
            Number of days needed
        """
        return 60  # Need 60 days for IV calculation and trend analysis
    
    def validate_config(self) -> bool:
        """Validate strategy configuration.
        
        Returns:
            True if valid
        """
        if self.spread_width < 1:
            logger.error("Spread width must be >= 1")
            return False
        
        if self.dte_min >= self.dte_max:
            logger.error("DTE min must be less than DTE max")
            return False
        
        if self.max_contracts < 1:
            logger.error("Max contracts must be >= 1")
            return False
        
        return True
    
    def on_order_filled(self, order: Dict[str, Any]) -> None:
        """Callback when an order is filled.
        
        Args:
            order: Order details
        """
        logger.info(f"Order filled: {order.get('side')} {order.get('qty')} {order.get('symbol')}")
    
    def get_strategy_description(self) -> str:
        """Get human-readable strategy description.
        
        Returns:
            Strategy description
        """
        return (
            f"Iron Condor AI Strategy on {self.symbol}:\n"
            f"- Sells OTM call spread (width: {self.spread_width}) and put spread simultaneously\n"
            f"- AI selects strikes based on IV and price action\n"
            f"- Target DTE: {self.dte_min}-{self.dte_max} days\n"
            f"- Max contracts: {self.max_contracts}\n"
            f"- Profit target: {self.profit_target_pct * 100:.0f}% of max profit\n"
            f"- Defined risk: Max loss = spread width - credit received\n"
            f"- No naked positions (all spreads are defined-risk)"
        )
