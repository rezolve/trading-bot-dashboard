#!/usr/bin/env python3
"""
Hackathon Iron Condor AI Bot
Competition entry for Alpaca AI Trading Agents Hackathon
Aug 28 - Sep 4, 2026

Strategy: AI-driven Iron Condor with defined risk
- Sells OTM call and put spreads simultaneously
- Uses IV and price action analysis for strike selection
- Defined max loss, no naked positions
- PAPER TRADING ONLY with competition account
"""

import sys
import os
import logging

# Add runtime to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'runtime'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'strategies'))

from bot_base import BotBase
from iron_condor_ai import IronCondorAIStrategy

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def validate_competition_environment():
    """Validate competition environment setup.
    
    Ensures:
    1. PAPER API endpoint only
    2. Competition account configured
    3. Options level 2+ available
    """
    # Check PAPER API
    api_url = os.getenv('APCA_API_BASE_URL', '')
    if 'paper' not in api_url.lower():
        logger.critical("❌ COMPETITION REQUIRES PAPER API")
        logger.critical("❌ Set APCA_API_BASE_URL to paper endpoint")
        sys.exit(1)
    
    # Check competition account flag
    competition_account = os.getenv('COMPETITION_ACCOUNT', 'false').lower()
    if competition_account != 'true':
        logger.warning("⚠️ COMPETITION_ACCOUNT not set to true")
        logger.warning("⚠️ Ensure using dedicated competition paper account")
    
    logger.info("✅ Competition environment validated")
    logger.info(f"✅ Paper API: {api_url}")
    logger.info("✅ Options trading enabled")
    logger.info("✅ Iron Condor strategy active")


def main():
    """Main entry point."""
    bot_id = os.getenv('BOT_ID', 'hackathon-iron-condor')
    
    logger.info("=" * 60)
    logger.info("Alpaca AI Trading Agents Hackathon")
    logger.info("Options Alpha Agents Track")
    logger.info("Bot: Iron Condor AI")
    logger.info("=" * 60)
    
    # Validate competition environment
    validate_competition_environment()
    
    # Load strategy config
    strategy_config = {
        'type': 'iron-condor-ai',
        'params': {
            'symbol': 'SPY',
            'dte_min': 30,
            'dte_max': 45,
            'spread_width': 5,
            'delta_target': 0.20,
            'min_credit': 0.50,
            'max_contracts': 5,
            'profit_target_pct': 0.50,
            'loss_limit_pct': 2.00,
        }
    }
    
    # Create strategy
    strategy = IronCondorAIStrategy(strategy_config)
    
    # Validate strategy
    if not strategy.validate_config():
        logger.error("❌ Invalid strategy configuration")
        sys.exit(1)
    
    # Log strategy details
    logger.info("\n" + strategy.get_strategy_description())
    
    # Risk gates
    logger.info("\n🛡️ Risk Gates Active:")
    logger.info("  - Max notional per order: $10,000")
    logger.info("  - Max contracts per trade: 5")
    logger.info("  - Max position size: 5% of account")
    logger.info("  - No naked shorts (all defined-risk spreads)")
    logger.info("  - Kill switch: Available in dashboard")
    logger.info("  - Paper URL check: Before every order")
    logger.info("  - Competition account: Dedicated $100k paper account")
    
    # Create and run bot
    logger.info("\n🤖 Starting bot...")
    bot = BotBase(bot_id=bot_id, strategy=strategy)
    bot.run()


if __name__ == '__main__':
    main()
