# Economy Configuration: [Game Name]

## Currencies

| Currency | Type | Earn Source | Spend Sink | Persistence | Cap |
|----------|------|-----------|-----------|-------------|-----|
| [Name] | Soft (earned) | [Sources] | [Sinks] | [Resets on prestige? Persists?] | [Max holdable] |
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

| Product | Stripe Price ID | Hard Currency | Real Money | Notes |
|---------|----------------|--------------|------------|-------|
| Small bundle | price_xxx | 100 | $0.99 | Impulse buy |
| Medium bundle | price_xxx | 550 | $4.99 | Best value callout |
| Large bundle | price_xxx | 1200 | $9.99 | Whale bait |
| Premium pass | price_xxx | 500/month + perks | $4.99/mo | Recurring |

## Health Check Formulas

```
inflation_rate = total_faucets_per_day / total_sinks_per_day
// Target: 0.8 - 1.2

median_wealth = median(all_player_currency)
// Target: 2-5x average item cost

time_to_first_purchase = time_until(player.currency >= cheapest_useful_item.cost)
// Target: 5-15 minutes
```
