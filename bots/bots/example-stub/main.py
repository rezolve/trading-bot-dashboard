#!/usr/bin/env python3
"""
Example Stub Bot
"""

import sys
import os

# Add runtime to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'runtime'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'strategies'))

from bot_base import BotBase
from stub_strategy import StubStrategy


def main():
    """Main entry point."""
    bot_id = os.getenv('BOT_ID', 'example-stub')
    
    # Load strategy config
    strategy_config = {
        'type': 'stub',
        'params': {}
    }
    
    # Create strategy
    strategy = StubStrategy(strategy_config)
    
    # Create and run bot
    bot = BotBase(bot_id=bot_id, strategy=strategy)
    bot.run()


if __name__ == '__main__':
    main()
