# Economy Configuration: [Game Name]

## Currencies

| Currency | Type | Earn Source | Spend Sink | Persistence | Cap |
|----------|------|-----------|-----------|-------------|-----|
| [Name] | Soft (earned) | [Sources] | [Sinks] | [Reset behavior] | [Max holdable] |
| [Name] | Hard (premium) | [Purchase / rare drops] | [Cosmetics / QoL] | Permanent | [None] |

## Faucets (Income)

| Source | Currency | Amount | Frequency | Notes |
|--------|----------|--------|-----------|-------|
| [Combat victory] | [Soft] | [10-50 scaled by level] | Per encounter | Main income source |
| [Quest completion] | [Soft] | [100-500] | Per quest | Burst income |
| [Daily login] | [Soft + Hard] | [50 soft + 5 hard] | Daily | Retention hook |
| [Achievement] | [Hard] | [10-50] | One-time | Milestone reward |

## Sinks (Spending)

| Sink | Currency | Cost Range | Purpose |
|------|----------|-----------|---------|
| [Upgrades] | [Soft] | [Exponential scaling] | Core progression |
| [Crafting fees] | [Soft] | [% of material value] | Currency drain |
| [Cosmetics] | [Hard] | [50-500] | Premium monetization |
| [Respec/reset] | [Soft] | [Escalating] | Prevent free experimentation |

## Balance Targets

| Stage | Playtime | Expected Soft Currency/hr | Expected Hard Currency/hr |
|-------|----------|--------------------------|--------------------------|
| Early | 0-2h | [200] | [10] |
| Mid | 2-10h | [500] | [5] |
| Late | 10-50h | [1000] | [3] |
| Endgame | 50h+ | [2000] | [2] |

## Reward Tables

### Common Drop Table
| Item | Weight | Min Level | Notes |
|------|--------|-----------|-------|
| [Common item] | 60 | 1 | Filler |
| [Uncommon item] | 25 | 1 | Useful |
| [Rare item] | 10 | 5 | Exciting |
| [Epic item] | 4 | 10 | Memorable |
| [Legendary item] | 1 | 20 | Life-changing |

### Pity System
- Guarantee rare+ after [50] drops without one
- Counter resets on any rare+ drop

## Monetization Map

Use `stripe-game-payments` for the purchase flow.

| Product | Price ID | Currency granted | Real money | Notes |
|---------|----------|------------------|------------|-------|
| [Bundle] | [id] | [amount] | [price] | [notes] |

## Health Checks

Set each target from playtest data. Record the target here.

| Check | Formula | Target |
|-------|---------|--------|
| Flow ratio | (faucets - sinks) / faucets, per currency per day | [set] |
| Money supply | sum of all player balances, per currency | [set] |
| Wealth skew | median balance / mean balance | [set] |
| Time to first purchase | time until balance >= cheapest useful item | [set] |
