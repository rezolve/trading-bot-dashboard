# Research Module

## Overview

The Research module is the iteration arm of the trading bot fleet system. While the Fleet page handles bot execution (swapping bots in/out of paper trading), the Research page tracks strategy evolution, experiments, and performance across generations.

## Core Concepts

### Strategy Families

A **Research Family** groups related bots and experiments that explore variations of the same underlying strategy. Each family has:

- **Name**: Human-readable identifier (e.g., "SPY Opening Range Breakout v2")
- **Book**: Trading style category (ORB, Day-trade, Swing, Position)
- **Asset Class**: Stock or Option
- **Side**: Long, Short, or Both
- **Holds Overnight**: Boolean flag for position management
- **Champion Bot**: Best-performing bot in the family (by holdout return)
- **Benchmark**: Comparison baseline (e.g., SPY buy-and-hold)

### Experiments

A **Research Experiment** represents a single parameter tweak or hypothesis test within a family:

- **Hypothesis**: What you're testing (e.g., "Tighter stop loss improves Sharpe")
- **Tweak**: Parameter changes from parent bot (as JSON object)
- **Kill Rule**: Conditions that would disqualify this variant
- **In-Sample Period**: Training/optimization window (start/end dates)
- **Holdout Period**: Out-of-sample validation window (start/end dates)
- **Status**: queued → scored → kept/killed
- **Generation**: Iteration number in the family tree
- **Returns**: Both in-sample and holdout performance metrics

### Ideas

A **Research Idea** is a potential experiment captured from external sources:

- **Source URL**: Where the idea came from (research paper, blog post, etc.)
- **Parameter Diff**: Suggested changes from current best
- **Kill Rule**: Red flags that would reject this idea
- **Critic Verdict**: keep | kill | rewrite | null
- **Status**: new → queued_experiment | rejected

### Backtest Splits

Backtests can now be tagged with a `split` field:

- **in_sample**: Training/optimization run
- **holdout**: Out-of-sample validation run
- **full**: Complete historical backtest (not split)

This enables proper walk-forward analysis and overfit detection.

## User Interface

### Research Page (`/dashboard/research`)

Grid of research families grouped by book (ORB, Day-trade, Swing, Position). Each family card shows:

- Family name
- Asset class and side
- Champion bot ID
- Last holdout return (ending $ from $100k start)

Click a family card to view details.

### Family Detail Page (`/dashboard/research/[familyId]`)

#### Headline Section
- Family name, book, side, asset class, overnight flag
- Champion bot ID (links to bot detail)

#### Overfit Detector
Visual alert if the latest experiment shows IS/OOS gap > 5%:
- In-Sample return %
- Out-of-Sample (holdout) return %
- Gap value
- Warning indicator if potential overfit detected

#### Performance Evolution Chart
Simple SVG line chart showing:
- X-axis: Generation number
- Y-axis: Holdout return %
- Points colored by status (green = kept, gray = scored)
- Baseline axis labels for min/max return

#### Experiments Table
All experiments for this family, showing:
- Hypothesis (text description)
- Tweak summary (first 2 parameter names)
- IS % (in-sample return)
- OOS % (holdout return)
- Status (kept/killed/scored/queued)

#### Ideas Table (if any)
Research ideas for this family:
- Source URL
- Parameter diff summary
- Critic verdict (keep/kill/rewrite/pending)
- Status (new/queued_experiment/rejected)

## Data Flow

1. **Trading Bot agent** creates research families in Firestore (`research-families` collection)
2. **Trading Bot agent** proposes experiments, writes to `research-experiments` collection
3. **Cloud Functions** (or agent) run backtests tagged with `familyId`, `experimentId`, `generation`, `split`
4. **Dashboard** reads completed experiments and displays evolution, overfit detection, and performance tracking
5. **User** reviews results, decides which variants to promote to the Fleet for paper trading

## Mobile-Friendly Design

- Responsive grid on research page
- Stacked columns on small screens
- Horizontal scroll tables for experiments/ideas
- Touch-friendly tap targets (44px min)
- SVG chart scales to container width

## Security & Access

Firestore rules ensure:
- Users can only read/write their own research families
- Users can only read/write their own experiments and ideas
- Research collections follow same userId scoping as bots/backtest-runs

## Integration with Fleet

- **Champion bot** from a research family can be swapped into Live (paper trading) via Fleet page
- **Bot detail page** shows which family a bot belongs to (if `familyId` is set)
- **Backtest history** can include both full backtests (from Fleet) and split backtests (from Research)

## Empty States

When no research families exist, the Research page shows:
- Empty state message: "Research families are created by the Trading Bot agent"
- FlaskConical icon
- No "Create Family" button (monitor/controls only)

When a family has no experiments yet:
- Table shows "No experiments yet"

When a family has no ideas:
- Ideas section is hidden

## Next Steps

- Trading Bot agent will populate research families and experiments
- Agent will run walk-forward analysis with in-sample/holdout splits
- Agent will track parameter evolution across generations
- Agent will flag potential overfitting when IS/OOS gap is large
- User reviews performance evolution and promotes champions to Fleet

## Files

### UI Components
- `app/dashboard/research/page.tsx` - Research families grid
- `app/dashboard/research/[familyId]/page.tsx` - Family detail with chart and tables

### Types
- `lib/types.ts`:
  - `ResearchFamily`
  - `ResearchExperiment`
  - `ResearchIdea`
  - `BacktestSplit` (enum: in_sample | holdout | full)
  - Extended `BacktestRun` with optional `familyId`, `experimentId`, `generation`, `split`

### Security & Indexes
- `firestore.rules` - User-scoped read/write for research collections
- `firestore.indexes.json` - Efficient queries for `research-families`, `research-experiments`, `research-ideas`

### Navigation
- `app/dashboard/layout.tsx` - Research link in sidebar/drawer (not in bottom mobile tab bar)

## Design Philosophy

**Research is for iteration, Fleet is for execution.**

- Research tracks performance evolution across many parameter variants
- Research detects overfitting via in-sample vs holdout comparison
- Research captures external ideas and tracks critic verdicts
- Fleet manages which bots are currently paper-live
- Fleet provides real-time monitoring and controls
- Champion from Research graduates to Fleet when ready for paper trading
