"""
Base bot class for paper trading.
"""

import os
import sys
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from firebase_client import FirebaseClient
from alpaca_client import AlpacaClient, validate_paper_only
from strategy_interface import StrategyInterface

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BotBase:
    """Base class for trading bots."""
    
    def __init__(self, bot_id: str, strategy: StrategyInterface):
        """Initialize bot.
        
        Args:
            bot_id: Bot ID
            strategy: Trading strategy instance
        """
        self.bot_id = bot_id
        self.strategy = strategy
        
        # Enforce paper-only FIRST
        try:
            validate_paper_only()
        except ValueError as e:
            logger.critical(f"Paper-only validation failed: {e}")
            sys.exit(1)
        
        # Initialize clients
        use_emulator = os.getenv('FIREBASE_EMULATOR', 'false').lower() == 'true'
        self.firebase = FirebaseClient(use_emulator=use_emulator)
        self.alpaca = AlpacaClient()
        
        # Load bot config from Firestore
        self.config = self.firebase.get_bot_config(bot_id)
        if not self.config:
            logger.error(f"Failed to load config for bot {bot_id}")
            sys.exit(1)
        
        self.user_id = self.config.get('userId')
        self.paper_live = self.config.get('paperLive', False)
        self.risk_limits = self.config.get('riskLimits', {})
        
        logger.info(f"Bot {bot_id} initialized (paperLive={self.paper_live})")
    
    def run(self) -> None:
        """Main bot loop."""
        logger.info(f"Bot {self.bot_id} starting...")
        
        self.firebase.log_activity(
            bot_id=self.bot_id,
            user_id=self.user_id,
            event_type='bot_created',
            message=f'Bot {self.bot_id} started',
            metadata={'timestamp': datetime.now().isoformat()}
        )
        
        try:
            while True:
                # Check if bot should still be running
                self.config = self.firebase.get_bot_config(self.bot_id)
                if not self.config:
                    logger.warning("Bot config not found, stopping")
                    break
                
                self.paper_live = self.config.get('paperLive', False)
                
                if not self.paper_live:
                    logger.info("Bot is not paper-live, waiting...")
                    time.sleep(60)
                    continue
                
                # Execute trading logic
                try:
                    self._execute_trading_cycle()
                except Exception as e:
                    logger.error(f"Error in trading cycle: {e}")
                    self.firebase.log_activity(
                        bot_id=self.bot_id,
                        user_id=self.user_id,
                        event_type='error',
                        message=f'Trading cycle error: {str(e)}',
                        metadata={'error': str(e)}
                    )
                
                # Wait before next cycle
                time.sleep(60)  # 1 minute
        
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        except Exception as e:
            logger.critical(f"Bot crashed: {e}")
            self.firebase.log_activity(
                bot_id=self.bot_id,
                user_id=self.user_id,
                event_type='error',
                message=f'Bot crashed: {str(e)}',
                metadata={'error': str(e)}
            )
        finally:
            self._shutdown()
    
    def _execute_trading_cycle(self) -> None:
        """Execute one trading cycle."""
        logger.info("Executing trading cycle...")
        
        # Get account info
        account = self.alpaca.get_account()
        if not account:
            logger.warning("Could not get account info")
            return
        
        # Get current positions
        positions = self.alpaca.get_positions()
        logger.info(f"Current positions: {len(positions)}")
        
        # Sync positions to Firestore
        for position in positions:
            self.firebase.save_position(
                bot_id=self.bot_id,
                user_id=self.user_id,
                position=position
            )
        
        # Generate signals from strategy
        # (In production, this would fetch real-time market data)
        signals = self.strategy.generate_signals(None)
        
        if not signals:
            logger.debug("No signals generated")
            return
        
        logger.info(f"Generated {len(signals)} signals")
        
        # Process each signal
        for signal in signals:
            logger.info(f"Processing signal: {signal.signal_type.value} {signal.symbol}")
            
            # Apply risk limits
            if not self._check_risk_limits(signal, account):
                logger.warning(f"Signal rejected by risk limits: {signal.symbol}")
                continue
            
            # Calculate position size
            qty = self.strategy.get_position_size(signal, account['equity'])
            
            if qty <= 0:
                logger.warning(f"Invalid quantity calculated: {qty}")
                continue
            
            # Place order
            order_id = self.alpaca.place_market_order(
                symbol=signal.symbol,
                qty=qty,
                side=signal.signal_type.value
            )
            
            if order_id:
                self.firebase.log_activity(
                    bot_id=self.bot_id,
                    user_id=self.user_id,
                    event_type='trade_executed',
                    message=f'{signal.signal_type.value.upper()} {qty} {signal.symbol}',
                    metadata={
                        'orderId': order_id,
                        'symbol': signal.symbol,
                        'qty': qty,
                        'side': signal.signal_type.value,
                    }
                )
    
    def _check_risk_limits(self, signal: Any, account: Dict[str, Any]) -> bool:
        """Check if signal passes risk limit checks.
        
        Args:
            signal: Trading signal
            account: Account information
            
        Returns:
            True if signal passes risk limits
        """
        # Check max notional per order
        max_notional = self.risk_limits.get('maxNotionalPerOrder', 10000)
        estimated_notional = signal.quantity * 100 if signal.quantity else 0
        
        if estimated_notional > max_notional:
            logger.warning(f"Order exceeds max notional: {estimated_notional} > {max_notional}")
            return False
        
        # Check allowed asset classes
        allowed_classes = self.risk_limits.get('allowedAssetClasses', ['stock'])
        # For now, assume all signals are for stocks
        if 'stock' not in allowed_classes:
            logger.warning("Stock orders not allowed by risk limits")
            return False
        
        return True
    
    def _shutdown(self) -> None:
        """Shutdown bot gracefully."""
        logger.info(f"Bot {self.bot_id} shutting down...")
        
        self.firebase.log_activity(
            bot_id=self.bot_id,
            user_id=self.user_id,
            event_type='swapped_out',
            message=f'Bot {self.bot_id} stopped',
            metadata={'timestamp': datetime.now().isoformat()}
        )
