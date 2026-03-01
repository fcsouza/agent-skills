# Game Economy Design

## Purpose

Virtual currencies, sinks/faucets, inflation control, reward balancing, and monetization integration. Genre-agnostic — applies to any game with resources, currencies, or tradeable items.

## When to Use

Trigger: game economy, virtual currency, sinks and faucets, inflation, reward balance, loot tables, crafting economy, marketplace, monetization, pricing, premium currency, gold sinks, resource balance

## Prerequisites

- `game-design-fundamentals` — core loop understanding
- `postgres-game-schema` — currency and item data models

## Core Principles

> Sid Meier: "A game is a series of interesting decisions" — economy makes decisions meaningful.
> Richard Garfield: "Elegant systems create depth from simple rules."
> Raph Koster: "Players will optimize the fun out of your game" — design economies that stay fun when optimized.
> Will Wright: "Simulation systems generate emergent behavior" — economies should emerge, not be scripted.

1. **Every faucet needs a sink** — if players earn currency, they must spend it; otherwise inflation destroys the economy
2. **Two-currency model** — soft currency (earned in-game, plentiful) + hard currency (premium, scarce, optional) keeps free players engaged while monetizing
3. **Exponential costs, linear income** — the natural idle game pattern; cost scaling must outpace earning to maintain engagement
4. **Price anchoring** — establish what things "should" cost early; players will judge all future prices against the first items they buy
5. **Never sell power directly** — sell time, cosmetics, convenience; pay-to-win destroys retention (Sid Meier principle)
6. **Closed-loop economy** — track total currency in circulation; if it grows unbounded, you have a leak
7. **Test with spreadsheets first** — simulate 100 hours of play before coding; if the spreadsheet breaks, the game will too

## Step-by-Step Instructions

### 1. Define Currencies
List every currency: name, how earned, how spent, persistence on reset.

### 2. Map Faucets (Income Sources)
Every way players earn currency: combat rewards, quest rewards, daily login, achievements, trading.

### 3. Map Sinks (Spending Destinations)
Every way players spend: upgrades, crafting, shop, repairs, fees, taxes, cosmetics.

### 4. Balance the Spreadsheet
Create a spreadsheet simulating player income vs. spending over time. Target: net currency growth should be slow or zero at every stage.

### 5. Define Reward Tables
Use weighted random for drops, with pity system for rare items. Cross-reference `quest-mission-design` for quest rewards.

### 6. Integrate Monetization
Map premium currency to Stripe products via `stripe-game-payments`. Ensure premium currency can't break game balance.

## Economy Health Metrics

| Metric | Healthy Range | Warning Sign |
|--------|-------------|-------------|
| Daily currency earned / spent ratio | 0.8-1.2 | > 1.5 (inflation) or < 0.5 (deflation) |
| Median player currency held | 2-5x average purchase cost | > 20x (nothing to buy) |
| Premium conversion rate | 2-5% of active players | < 1% (too expensive) or > 15% (too aggressive) |
| Time to first meaningful purchase | 5-15 minutes | > 30 min (slow start) |

## Cross-References

- `postgres-game-schema` — currency and item table schemas
- `stripe-game-payments` — premium currency and IAP integration
- `quest-mission-design` — quest reward balancing
- `game-design-fundamentals` — core loop reward schedules
- `redis-game-patterns` — leaderboard caching for economy rankings

## Pitfalls & Anti-Patterns

- **"Hyperinflation"** — unlimited faucets with no sinks; currency becomes worthless
- **"Pay-to-win"** — selling direct gameplay advantages; kills free player retention
- **"Currency confusion"** — too many currency types; players can't understand what to spend
- **"Dead economy"** — nothing interesting to buy; currency accumulates uselessly
- **"Exploitable loops"** — crafting or trading loops that generate infinite value
- **"Early abundance"** — giving too much currency early; players expect it forever

## Designer Philosophy

**Sid Meier**: The economy exists to make decisions interesting. If every choice has an obvious best option, the economy has failed. Players should regularly face "do I buy upgrade A or save for upgrade B?" dilemmas.

**Richard Garfield** (Magic: The Gathering): The best economies emerge from simple, elegant rules. A few well-designed resource types with clear trade-offs create more depth than a dozen currencies that nobody understands.

**Raph Koster**: Players will find the optimal farming strategy and grind it. Design your economy so that even the optimal path is fun, and the sub-optimal paths are still viable.

## Sources

- "Designing Virtual Economies" — GDC 2017
- "Free-to-Play Game Economies" — GDC 2019
- "Theory of Fun" — Raph Koster
- "The Art of Game Design" — Jesse Schell, Chapter on Game Mechanics
- Stripe gaming best practices documentation
