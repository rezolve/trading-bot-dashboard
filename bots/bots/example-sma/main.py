#!/usr/bin/env python3
"""
Example SMA Crossover Bot
"""

import sys
import os

# Add runtime to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'runtime'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'strategies'))

from bot_base import BotBase
from sma_crossover import SMAcrossoverStrategy


def main():
    """Main entry point."""
    bot_id = os.getenv('BOT_ID', 'example-sma')
    
    # Load strategy config
    strategy_config = {
        'type': 'sma-crossover',
        'params': {
            'fast_period': 10,
            'slow_period': 30,
            'symbol': 'SPY',
            'position_size_pct': 0.20
        }
    }
    
    # Create strategy
    strategy = SMAcrossoverStrategy(strategy_config)
    
    # Validate strategy
    if not strategy.validate_config():
        print("Invalid strategy configuration")
        sys.exit(1)
    
    # Create and run bot
    bot = BotBase(bot_id=bot_id, strategy=strategy)
    bot.run()


if __name__ == '__main__':
    main()
