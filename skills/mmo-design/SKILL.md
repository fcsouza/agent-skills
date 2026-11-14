---
name: mmo-design
description: Covers the design choices that only a persistent online world with many players forces: shards versus layers, economy measurement and real-money trade policy at persistent-world scale, characters and alts, group roles and guilds, endgame, and live operations. Use when a game is a persistent world with many players and needs a decision on shards or layers, how to watch money supply and deflation, a real-money trade policy, several characters per account, tank/healer/damage roles, guild structure, a level cap or endgame, or seasons and patch cadence.
---

# MMO Design

This skill decides the questions that appear only when a world persists and many players share it. It names the choice, the evidence and the trade-off. The mechanics live in other skills. Read those for the how.

Most sources here are period data from specific games. Read each number as that game's result at that time, not as a rule for yours.

## 1. World partitioning and scale

Decide the unit of load before you write the netcode. `game-backend-architecture` ("When one space outgrows a process") has the decisions: the unit of load, the floor below which a hot area cannot split, moving non-spatial services off the simulation, and the overload policy, with EVE's evidence. `game-state-sync` has interest filtering. The design choices that stay here:

1. **Pick the copy policy.** A shard is a full copy of the world with its own data. Layering (WoW Classic) runs parallel copies of one realm for launch crowds. Blizzard called it temporary and reduced the layers per realm as players spread out.
2. **Decide whether copies are permanent.** This skill's advice, not a sourced rule: choose at launch whether your copies are shards that stay or layers that go, because players form ties inside a copy.
3. **Choose the overload policy before launch.** Options: dilate time, shed load, cap the area, split the area. The mechanics and the clock rules are in `game-backend-architecture`.

## 2. Economy at scale

`game-economy-design` owns the mechanics: open versus closed economy, goods over coin, faucets and sinks, exploit review and duplication. These are the choices a persistent world adds.

1. **Expect deflation as well as inflation.** Castronova's 29-item price index for EverQuest fell from 100 in Q4 2000 to 71 in Q3 2001. Items from expansions fell furthest. He built an equal-weight index from a fan price site and says a true index needs a survey.
2. **Watch the float.** CCP's monthly economic report charts money supply (ISK float), velocity, consumer and producer price indices, sinks and faucets, and production against destruction. Track a similar set for your world, and give someone the job: CCP hired an economist in 2007 to watch faucets and sinks.
3. **Treat a faucet change as a price change.** The balance of sinks and faucets sets the inflation rate, and with it what a unit of currency buys. `game-economy-design` has the simulation step to run first.
4. **Expect players to leave and to lobby.** Bartle: a player whom the market pays badly leaves for a world that pays. Players will also lobby the team to fix prices. If the team adjusts supply or demand, expect players to distrust the change. Bartle suggests giving a committee of players a say so they carry the blame.
5. **Route trades and spends through the server's guarded paths.** Trade checks are in `game-backend-architecture` ("What lives where"). Guarded spends are `spendCurrency` in `postgres-game-schema`.
6. **Choose your real-money trade policy.** Bartle says it will occur in any large commercial world. The options are black, grey or white market. Decide before launch and tell players.

## 3. Characters and accounts

Decide the slot policy and the ownership of each thing before you create tables. `postgres-game-schema` holds the schema.

1. **Pick the slot policy.** Bartle sets out both sides. Several slots per account let players try other selves and recover from a mistake. One character per account stops mules and players who act badly without fear of reprisal. Star Wars Galaxies used one, and Bartle reports its official reason was database size. On British Legends, with one character per account, some players bought a dozen or more accounts.
2. **Treat alts as normal.** In Livingston and colleagues' interviews with twenty WoW players, all had at least one alt. Some alts existed only as bank storage or for trade. At the time of that study WoW allowed ten characters per server and fifty per account.
3. **Split account-wide from per-character.** Blizzard's Warbands made this split explicit: shared reputations, a shared bank, collection of appearances from any character. Decide it for currency, inventory, reputation, achievements and unlocks, and say it in the UI.
4. **Give catch-up without a many-alts advantage.** Blizzard's stated goal is that players with many alts get no intrinsic advantage over single-character players. Its mechanism: a quest grants Warband reputation only on first completion, then a different bonus on repeats.
5. **Plan for twinking.** Bartle: high-level characters give gear to new ones, which makes the newbie game feel worthless to players without a benefactor and makes content easier than designed. Write gear-transfer rules into the design. Add tooling for the live team to see linked characters, multi-lining and risk diverting.
6. **Plan names.** Uniqueness gets scarcer with population. Per-shard uniqueness cuts the demand.

Where to go: `character-design-narrative` for who the characters are; `postgres-game-schema` for the characters table and ownership.

## 4. Groups, roles and guilds

### Role design

Choose one, and write down what you give up.

1. **Dedicated roles (tank, healer, damage).** Psychochild lists why the pattern lasts: it is well tested, its problems are known, encounters can assume a group's makeup, and players understand roles. His costs: groups restricted to certain makeups, roles that translate badly to solo play and PvP, fewer character choices, and drift toward complexity.
2. **No dedicated roles.** Guild Wars 2 as ArenaNet's Jon Peters described it in 2011: every profession has a healing skill slot, every profession can revive downed allies, boons stack in duration but not in effect, and weapon swapping lets one character change role in a fight. Peters gives the goals as more dynamic, more social combat and fewer dependencies on one profession.
3. **Count role slots as a balance budget.** Yoshida gave three reasons for no new healer in FFXIV Shadowbringers: two new jobs per expansion was the team's limit, ranged physical damage had only two jobs, so the team added a third, and balancing the three healers was already hard. Each job added to a role adds balance work for the others in it.
4. **Know the social cost of fixed roles.** Chen's case study of a 40-player guild learning Molten Core shows the other side: role assignment is a coordination task the players run themselves, such as two named main tanks so warriors do not compete for threat.
5. **Promote dependence, do not force it.** Bartle: mutual dependence builds trust, but keep it optional. Solo players must still be able to do the job.

Do not cite Bartle for a tank/healer/damage law. His book names complementary roles as one way to form groups, with a smaller, more committed community as the effect, and he prefers a classless system or kits when you can afford them.

### Guilds and groups

Describe any group system on four axes (Bartle, ch. 5): formal or informal, temporary or permanent, flat or hierarchical, hardwired or softwired.

- Let players hold many temporary groups. Decide whether they may hold more than one permanent group. Bartle says several memberships raise attachment, while a single group matures faster.
- Keep temporary groups quick to form and disband.
- Guilds are the default social unit: in one early-2000s EverQuest survey, 81.8 percent of 1,703 respondents belonged to one (Yee).
- Koster's collected laws put ideal community size at no more than 250, past which you get subcommunities.
- Give every power in a group a check. Bartle: strike out any mechanism that gives one player unfettered power to make others miserable.

### Griefing and anti-social play

1. **Expect it.** Koster: violence is inevitable, so the design question is its form. Killing players rewards more than killing a game's targets, so PvP attracts. Anonymity makes it easier, and Koster names empathy as the way to fight it.
2. **Use Bartle's dynamics.** Too many killers drive away the achievers they prey on, and then the killers leave. A balanced mix of all four types is the longest-lived but hard to hold. Before a change, say which type it helps and which it hurts.
3. **Give the tools.** Bartle lists squelch and gag, a per-character setting for who may contact you, arenas, and character flags. Opt-in PvP flags fail when PvE players advance faster at less risk.
4. **Protect non-combat roles.** Bartle's tailor problem: a player who chose a non-combat role accepts some risk but not attack on a whim while she cannot defend herself.
5. **Consider NPC danger.** Bartle says players tolerate loss to mobiles more than to people, and a world can approximate killer pressure with them.

## 5. Long-term progression and endgame

1. **Name what the cap does.** Without a cap, characters outrun content and newcomers feel tiny. With a cap, players wait for content. Bartle names permanent death as the only guaranteed fix and says commercial worlds avoid it.
2. **Know the cost of "more levels".** Bartle calls adding levels to keep players achieving the common and inhuman answer. Gear and level inflation follow, and the finish line keeps moving.
3. **Do not count remorting as a fix.** Resetting a capped character to level zero in a new class delays the problem. Bartle calls it a cop-out in one place and the likely answer for some players in another. Offer it as a choice, never as the endgame.
4. **Build the elder game from content players make.** Politics and player creation generate content cheaply. Bartle: politics suits some players, and player-built content is sticky for its creators but needs limits for quality.
5. **Match the endgame to who arrives.** Players who reach the top are not one type. Bartle's later model has players drift from griefer toward scientist, planner and friend.
6. **Fix the early game first.** Bartle: most churn is newcomers, and a flow of new players can hide a large gross leave rate. Report gross signups and gross churn, not net growth alone.

Where to go: `skill-progression-trees` for trees, costs and prestige mechanics.

## 6. Live operations

1. **Staff it for good.** Koster: keep a team on a persistent world indefinitely or it stagnates. Bartle describes a live team that does support, tech, feature work and protection of play quality against player cunning.
2. **Choose what a season resets.** Path of Exile's league-end notice shows one answer. The notice says equipped Grafts, growing wombgifts and Implant currencies are deleted and stored Graftblood is lost. Some mechanics move into the core game, others do not. Write the reset list before the season starts.
3. **Choose the cadence for your team.** Studios pick differently, and capacity decides.
   - FFXIV: after a delay, Yoshida said the team would return to a major patch roughly every three and a half months and would not speed up to recover time, because that would cut content and quality.
   - Path of Exile: Jonathan Rogers said the 3.26 league lost its date because staff were borrowed to ship Path of Exile 2. He said he should have resisted the move.
4. **Plan content reset.** Bartle: players consume content faster than the team makes it. A sudden reset allows complex content but rewards early arrivals. A rolling reset is smoother, but players camp spawn points.
5. **Read reaction to a change with care.** Bartle: most departures are quiet drift, not a public row. The loudest complainers care most and usually return within two weeks if they leave. Players misjudge their own type, so a poll of self-described explorers misleads.
6. **Test changes against the whole design.** Bartle: spreadsheets fix numbers but not fun. Write a dummy log or mock diary of weeks of play for each type before you ship.

## 7. Pitfalls

- One process owns a world that grows past it, with no overload policy.
- Watching only inflation.
- Wallet and inventory ownership left undecided until players have alts.
- Account-wide catch-up that gives many-alt players an edge.
- A role count nobody can balance.
- Group powers with no check.
- A cap with no content planned above it.
- A season that resets without a written list.
- A patch cadence the team cannot staff.

Citations are in `references/sources.md`. Read it when you need the source, edition or date behind a claim before you repeat it.
