#!/usr/bin/env python3
"""
Standalone backtest runner script.
Can be invoked by Cloud Functions or run locally.
"""

import sys
import os
import json
import logging
from datetime import datetime
from typing import Dict, Any

# Add strategies to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'strategies'))

from firebase_client import FirebaseClient
from backtest_runner import BacktestRunner
from sma_crossover import SMAcrossoverStrategy
from stub_strategy import StubStrategy

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_strategy_instance(strategy_config: Dict[str, Any]):
    """Get strategy instance based on config.
    
    Args:
        strategy_config: Strategy configuration
        
    Returns:
        Strategy instance
    """
    strategy_type = strategy_config.get('type', '')
    
    if strategy_type == 'sma-crossover':
        return SMAcrossoverStrategy(strategy_config)
    elif strategy_type in ['stub', 'mean-reversion']:
        return StubStrategy(strategy_config)
    else:
        logger.warning(f"Unknown strategy type: {strategy_type}, using stub")
        return StubStrategy(strategy_config)


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python run_backtest.py <backtest_id>")
        sys.exit(1)
    
    backtest_id = sys.argv[1]
    logger.info(f"Starting backtest: {backtest_id}")
    
    # Initialize Firebase client
    use_emulator = os.getenv('FIREBASE_EMULATOR', 'false').lower() == 'true'
    firebase = FirebaseClient(use_emulator=use_emulator)
    
    try:
        # Get backtest run document
        backtest_ref = firebase.db.collection('backtest-runs').document(backtest_id)
        backtest_doc = backtest_ref.get()
        
        if not backtest_doc.exists:
            logger.error(f"Backtest {backtest_id} not found")
            sys.exit(1)
        
        backtest_data = backtest_doc.to_dict()
        bot_id = backtest_data['botId']
        user_id = backtest_data['userId']
        
        logger.info(f"Bot ID: {bot_id}, User ID: {user_id}")
        
        # Get bot configuration
        bot_config = firebase.get_bot_config(bot_id)
        if not bot_config:
            logger.error(f"Bot {bot_id} not found")
            sys.exit(1)
        
        # Create strategy instance
        strategy = get_strategy_instance(bot_config['strategy'])
        if not strategy.validate_config():
            raise ValueError("Invalid strategy configuration")
        
        # Create backtest runner
        runner = BacktestRunner(
            backtest_id=backtest_id,
            bot_id=bot_id,
            user_id=user_id,
            strategy=strategy
        )
        
        # Run backtest
        start_date = backtest_data['startDate'].replace(tzinfo=None) if hasattr(backtest_data['startDate'], 'replace') else datetime.fromisoformat(backtest_data['startDate'].rstrip('Z'))
        end_date = backtest_data['endDate'].replace(tzinfo=None) if hasattr(backtest_data['endDate'], 'replace') else datetime.fromisoformat(backtest_data['endDate'].rstrip('Z'))
        initial_capital = backtest_data.get('initialCapital', 100000)
        
        results = runner.run(
            start_date=start_date,
            end_date=end_date,
            initial_capital=initial_capital
        )
        
        logger.info(f"Backtest completed successfully")
        logger.info(f"  Return: {results.total_return_percent:.2f}%")
        logger.info(f"  Sharpe: {results.sharpe_ratio:.2f}")
        logger.info(f"  Trades: {results.total_trades}")
        
    except Exception as e:
        logger.error(f"Backtest failed: {e}", exc_info=True)
        
        # Update backtest status to failed
        try:
            backtest_ref.update({
                'status': 'failed',
                'error': str(e),
                'completedAt': datetime.now()
            })
        except Exception as update_error:
            logger.error(f"Failed to update backtest status: {update_error}")
        
        sys.exit(1)


if __name__ == '__main__':
    main()
