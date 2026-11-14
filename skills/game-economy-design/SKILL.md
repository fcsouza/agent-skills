---
name: game-economy-design
description: Covers how players earn and spend in-game currency: faucets and sinks, inflation and deflation, shop prices, loot and reward tables, crafting loops and exploit review. Use when a game needs a currency plan, drop rates or prices to tune, or a check that currency flow stays balanced.
---

# Game Economy Design

An economy is two choices in a loop: how players earn, and how they spend. Any tradable thing counts as money, skill points included.

## Procedure

1. **List currencies.** For each: name, how earned, how spent, what a reset does to it, cap. Copy `templates/economy-config.md` when you need the sheet. Its numbers are placeholders.
2. **Map faucets.** A faucet creates currency from nothing. A transfer between players is not a faucet. List every one: combat, quests, daily login, NPC buyers, insurance payouts.
3. **Map sinks.** A sink destroys currency. Examples: shop prices (best on consumables), repair and upkeep, market taxes and broker fees, services players dislike doing (teleports priced by use), items that wear out, fees to exchange between currencies.
4. **Pick the model.** Default to an open faucet-and-drain economy that you manage. A closed economy (fixed money) is hard to balance, sensitive to bugs and easy to gouge, and no one has built one for a large world. If the game has little persistence, ask whether it needs an economy at all.
5. **Choose reward form.** Reward goods, not coin, where you can. Goods float with supply and demand. Fixed cash drops feel unfair once prices move. Goods inflate too: an item everyone owns is worth nothing.
6. **Set prices.** Fixed prices work only if the money a player can hold is capped. With unbounded money, fixed prices drift toward free, and crafters who sell at fixed prices lose first.
7. **Pick a cost curve on purpose.** Linear, exponential (1, 2, 4, 8, 16), triangular (1, 3, 6, 10, 15) or decreasing. Exponential numbers get large fast. Cost growth against income growth is your decision, so simulate it.
8. **Simulate before you ship.** Read `boilerplate/economy-simulator.ts` when you need to check balance. Run its `simulateStages` with your per-stage faucet and sink rates, or run the file with `bun boilerplate/economy-simulator.ts` for the built-in example. Fix any stage whose net flow is not where you want it. The in-memory tracker is for prototypes and tests. A live game writes each currency flow to the database (`postgres-game-schema`) and aggregates there.
9. **Design drops.** Use weighted tables with guaranteed drops and, where drops feel unfair, a pity counter. Copy `templates/loot-table.ts` when you need the types, including the optional `pity` field. The game keeps the counter per player. Price a conditional reward at its expected value: benefit times how often the condition holds.
10. **Review for exploits.** Assume players will find any loop that pays. Check every stack split, trade and drop path as a duplication surface. Check craft, sell and buy cycles for net gain. Cap offline and queued activity or players run mule factories.
11. **Add monetization last.** Selling power needs very careful balancing and attracts a narrow player type. Selling time, cosmetics and convenience is the safer default. For premium currency and purchases use `stripe-game-payments`.

## What to track in a live game

- Total money supply, per currency (the float).
- Faucet and sink totals per source. `getTopSources` lists the biggest.
- A price index over a fixed basket of goods.
- Median and mean wealth per player. A median far below the mean means a few players hold most of it.
- ARPU and ARPPU, to see whether the problem is acquisition, conversion or retention.

Watch for deflation as well as inflation. In EverQuest's Norrath, a 29-item price index fell 29 percent in one year. Set your own target ranges from playtest data. This skill gives no universal numbers.

If inflation shows, cut the positive-sum sources or add sinks.

## Pitfalls

- Hyperinflation: faucets with no sinks.
- Dead economy: nothing worth buying, so currency piles up.
- Currency confusion: too many currencies.
- Duping and exploit loops: one bad stack or trade path can mint currency.
- Early abundance: players expect the early rate forever.
- Players quit rather than accept a bad market, and they gouge a market they can model. Guaranteed NPC buyers remove the reason to make what players want.
- Adjusting prices by hidden levers erodes trust. Players see the effect, not the mechanism.
- Players tune toward the optimum: given the chance, they optimize the fun out of a game. Make the optimal path fun.

## Files

- `templates/economy-config.md`: copy when you start a new economy sheet.
- `templates/loot-table.ts`: copy when you need loot table types and rarity weights.
- `boilerplate/economy-simulator.ts`: read when you need the flow tracker, inflation alerts or the stage simulation.
- `references/sources.md`: read when you need the source behind a claim.

## Related skills

`game-design-fundamentals` (core loop), `postgres-game-schema` (currency and item tables), `stripe-game-payments` (real-money purchases), `quest-mission-design` (quest rewards), `procedural-gen` (seeded random content; this skill owns the loot table types, and the game supplies the roller).
