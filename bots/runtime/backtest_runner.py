"""
Backtest runner for trading strategies.
"""

import os
import sys
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict

from firebase_client import FirebaseClient
from alpaca_client import AlpacaClient, validate_paper_only
from strategy_interface import StrategyInterface, SignalType

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class BacktestTrade:
    """A single backtest trade."""
    entry_date: str
    exit_date: str
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_percent: float
    return_pct: float


@dataclass
class BacktestResults:
    """Backtest results."""
    start_date: str
    end_date: str
    initial_capital: float
    final_equity: float
    total_return: float
    total_return_percent: float
    max_drawdown: float
    max_drawdown_percent: float
    sharpe_ratio: float
    total_trades: int
    profitable_trades: int
    losing_trades: int
    win_rate: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    trades: List[Dict[str, Any]]
    equity_curve: List[Dict[str, Any]]


class BacktestRunner:
    """Backtest runner for trading strategies."""
    
    def __init__(self, backtest_id: str, bot_id: str, user_id: str,
                 strategy: StrategyInterface):
        """Initialize backtest runner.
        
        Args:
            backtest_id: Backtest ID
            bot_id: Bot ID
            user_id: User ID
            strategy: Trading strategy instance
        """
        self.backtest_id = backtest_id
        self.bot_id = bot_id
        self.user_id = user_id
        self.strategy = strategy
        
        # Enforce paper-only
        try:
            validate_paper_only()
        except ValueError as e:
            logger.critical(f"Paper-only validation failed: {e}")
            sys.exit(1)
        
        # Initialize clients
        use_emulator = os.getenv('FIREBASE_EMULATOR', 'false').lower() == 'true'
        self.firebase = FirebaseClient(use_emulator=use_emulator)
        self.alpaca = AlpacaClient()
        
        logger.info(f"Backtest runner initialized: {backtest_id}")
    
    def run(self, start_date: datetime, end_date: datetime, 
            initial_capital: float = 100000) -> BacktestResults:
        """Run backtest.
        
        Args:
            start_date: Start date
            end_date: End date
            initial_capital: Initial capital
            
        Returns:
            Backtest results
        """
        logger.info(f"Running backtest: {start_date} to {end_date}")
        
        # Update backtest status
        self._update_status('running')
        
        try:
            # Get historical data
            symbol = self.strategy.params.get('symbol', 'SPY')
            bars = self.alpaca.get_historical_bars(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                timeframe='1Day'
            )
            
            if bars is None or len(bars) == 0:
                raise ValueError("No historical data available")
            
            # Run backtest simulation
            results = self._simulate_backtest(
                bars=bars,
                initial_capital=initial_capital,
                start_date=start_date,
                end_date=end_date
            )
            
            # Save results to Cloud Storage
            self._save_results(results)
            
            # Update backtest status
            self._update_status('completed', summary=self._get_summary(results))
            
            logger.info(f"Backtest completed: Return={results.total_return_percent:.2f}%")
            return results
        
        except Exception as e:
            logger.error(f"Backtest failed: {e}")
            self._update_status('failed', error=str(e))
            raise
    
    def _simulate_backtest(self, bars: Any, initial_capital: float,
                          start_date: datetime, end_date: datetime) -> BacktestResults:
        """Simulate backtest on historical data.
        
        Args:
            bars: Historical bar data
            initial_capital: Initial capital
            start_date: Start date
            end_date: End date
            
        Returns:
            Backtest results
        """
        import pandas as pd
        import numpy as np
        
        # Initialize backtest state
        cash = initial_capital
        position = 0
        position_entry_price = 0
        equity_curve = []
        trades = []
        
        # Get signals for each bar
        for i, (date, bar) in enumerate(bars.iterrows()):
            current_price = bar['close']
            current_equity = cash + (position * current_price)
            
            # Record equity
            equity_curve.append({
                'date': date.isoformat(),
                'equity': current_equity,
                'cash': cash,
                'position_value': position * current_price,
            })
            
            # Generate signals using recent data
            if i < self.strategy.get_required_data_period():
                continue  # Not enough data yet
            
            recent_data = bars.iloc[:i+1]
            signals = self.strategy.generate_signals(recent_data)
            
            if not signals:
                continue
            
            signal = signals[0]  # Take first signal
            
            # Execute signal
            if signal.signal_type == SignalType.BUY and position == 0:
                # Open long position
                qty = self.strategy.get_position_size(signal, current_equity)
                cost = qty * current_price
                
                if cost <= cash:
                    position = qty
                    position_entry_price = current_price
                    cash -= cost
                    
                    logger.debug(f"{date}: BUY {qty} @ {current_price}")
            
            elif signal.signal_type == SignalType.SELL and position > 0:
                # Close long position
                proceeds = position * current_price
                cash += proceeds
                
                # Record trade
                pnl = proceeds - (position * position_entry_price)
                pnl_percent = (pnl / (position * position_entry_price)) * 100
                
                trades.append(BacktestTrade(
                    entry_date=date.isoformat(),
                    exit_date=date.isoformat(),
                    symbol=signal.symbol,
                    side='long',
                    entry_price=position_entry_price,
                    exit_price=current_price,
                    quantity=position,
                    pnl=pnl,
                    pnl_percent=pnl_percent,
                    return_pct=pnl_percent,
                ))
                
                logger.debug(f"{date}: SELL {position} @ {current_price} (P&L: {pnl:.2f})")
                
                position = 0
                position_entry_price = 0
        
        # Close any remaining position
        if position > 0:
            final_price = bars.iloc[-1]['close']
            proceeds = position * final_price
            cash += proceeds
            
            pnl = proceeds - (position * position_entry_price)
            pnl_percent = (pnl / (position * position_entry_price)) * 100
            
            trades.append(BacktestTrade(
                entry_date=bars.index[-1].isoformat(),
                exit_date=bars.index[-1].isoformat(),
                symbol=self.strategy.params.get('symbol', 'SPY'),
                side='long',
                entry_price=position_entry_price,
                exit_price=final_price,
                quantity=position,
                pnl=pnl,
                pnl_percent=pnl_percent,
                return_pct=pnl_percent,
            ))
        
        # Calculate final metrics
        final_equity = cash
        total_return = final_equity - initial_capital
        total_return_percent = (total_return / initial_capital) * 100
        
        # Calculate max drawdown
        equity_values = [e['equity'] for e in equity_curve]
        peak = equity_values[0]
        max_dd = 0
        for equity in equity_values:
            if equity > peak:
                peak = equity
            dd = (peak - equity) / peak if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
        
        max_drawdown = peak * max_dd
        max_drawdown_percent = max_dd * 100
        
        # Calculate trade statistics
        profitable = [t for t in trades if t.pnl > 0]
        losing = [t for t in trades if t.pnl < 0]
        
        win_rate = len(profitable) / len(trades) if trades else 0
        avg_win = np.mean([t.pnl for t in profitable]) if profitable else 0
        avg_loss = np.mean([t.pnl for t in losing]) if losing else 0
        
        total_wins = sum([t.pnl for t in profitable]) if profitable else 0
        total_losses = abs(sum([t.pnl for t in losing])) if losing else 0
        profit_factor = total_wins / total_losses if total_losses > 0 else 0
        
        # Calculate Sharpe ratio (simplified)
        if len(equity_curve) > 1:
            returns = np.diff([e['equity'] for e in equity_curve]) / equity_values[:-1]
            sharpe = (np.mean(returns) / np.std(returns)) * np.sqrt(252) if np.std(returns) > 0 else 0
        else:
            sharpe = 0
        
        return BacktestResults(
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            initial_capital=initial_capital,
            final_equity=final_equity,
            total_return=total_return,
            total_return_percent=total_return_percent,
            max_drawdown=max_drawdown,
            max_drawdown_percent=max_drawdown_percent,
            sharpe_ratio=sharpe,
            total_trades=len(trades),
            profitable_trades=len(profitable),
            losing_trades=len(losing),
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            profit_factor=profit_factor,
            trades=[asdict(t) for t in trades],
            equity_curve=equity_curve,
        )
    
    def _save_results(self, results: BacktestResults) -> None:
        """Save backtest results to Cloud Storage.
        
        Args:
            results: Backtest results
        """
        logger.info("Saving backtest results to Cloud Storage...")
        
        # Save full report
        report_json = json.dumps(asdict(results), indent=2)
        self.firebase.upload_backtest_artifact(
            user_id=self.user_id,
            bot_id=self.bot_id,
            backtest_id=self.backtest_id,
            filename='report.json',
            data=report_json.encode('utf-8')
        )
        
        # Save equity curve
        equity_json = json.dumps(results.equity_curve, indent=2)
        self.firebase.upload_backtest_artifact(
            user_id=self.user_id,
            bot_id=self.bot_id,
            backtest_id=self.backtest_id,
            filename='equity_curve.json',
            data=equity_json.encode('utf-8')
        )
        
        # Save trades CSV
        trades_csv = "entry_date,exit_date,symbol,side,entry_price,exit_price,quantity,pnl,pnl_percent\n"
        for trade in results.trades:
            trades_csv += f"{trade['entry_date']},{trade['exit_date']},{trade['symbol']},"
            trades_csv += f"{trade['side']},{trade['entry_price']},{trade['exit_price']},"
            trades_csv += f"{trade['quantity']},{trade['pnl']},{trade['pnl_percent']}\n"
        
        self.firebase.upload_backtest_artifact(
            user_id=self.user_id,
            bot_id=self.bot_id,
            backtest_id=self.backtest_id,
            filename='trades.csv',
            data=trades_csv.encode('utf-8')
        )
        
        logger.info("Results saved to Cloud Storage")
    
    def _update_status(self, status: str, summary: Optional[Dict[str, Any]] = None,
                      error: Optional[str] = None) -> None:
        """Update backtest status in Firestore.
        
        Args:
            status: Backtest status
            summary: Optional summary dict
            error: Optional error message
        """
        update_data = {'status': status}
        
        if status == 'running':
            update_data['startedAt'] = datetime.now()
        elif status in ['completed', 'failed']:
            update_data['completedAt'] = datetime.now()
        
        if summary:
            update_data['summary'] = summary
        
        if error:
            update_data['error'] = error
        
        # Update Firestore
        doc_ref = self.firebase.db.collection('backtest-runs').document(self.backtest_id)
        doc_ref.update(update_data)
        
        logger.info(f"Backtest status updated: {status}")
    
    def _get_summary(self, results: BacktestResults) -> Dict[str, Any]:
        """Get summary dict from results.
        
        Args:
            results: Backtest results
            
        Returns:
            Summary dict
        """
        return {
            'totalReturn': results.total_return,
            'totalReturnPercent': results.total_return_percent,
            'sharpeRatio': results.sharpe_ratio,
            'maxDrawdown': results.max_drawdown,
            'maxDrawdownPercent': results.max_drawdown_percent,
            'winRate': results.win_rate,
            'totalTrades': results.total_trades,
            'profitableTrades': results.profitable_trades,
            'losingTrades': results.losing_trades,
            'avgWin': results.avg_win,
            'avgLoss': results.avg_loss,
            'profitFactor': results.profit_factor,
        }
