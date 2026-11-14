---
name: game-anti-cheat
description: >-
  Covers how a developer defends their own online game against cheating: server-side input validation, withholding hidden state, lag-compensation limits, dupe-proof transfers, detection from server data and reports, and enforcement with delayed bans, appeals and refunds to victims. Use when a multiplayer game has speed hacks, wallhacks, aimbots, bots, item or currency dupes, real-money trading, boosting or win trading, or when planning how to detect and ban cheaters.
---

# Game anti-cheat

This skill is defensive. It names each cheat class only as far as you need to pick the countermeasure.

Everything here assumes the server is the authority: the client sends what it wants to do, the server decides what happens. A design where clients report results or each hold the full world state cannot be fixed by the steps below.

## Requires

- `game-backend-architecture` for server authority, the message schema and the action validation hook
- `redis-game-patterns` for per-action rate limits

## Threats and defences

| Threat | What the defender needs to know | Defence |
|---|---|---|
| Movement (speed, teleport, wall clipping) | The client claims a position or runs its clock fast | Never accept a position. Re-simulate each input from a direction at the server's speed, on the server's clock; charge input time against wall time (step 1) |
| Aim (aimbot, triggerbot) | Each input is a legal input; only the pattern over many is not | The server decides every hit (step 3). Detect from server-side statistics, confirm by human review (Detect) |
| Information exposure (wallhack, map hack, revealed cards) | Anything sent to the client is readable | Send each client only what it may know (step 2). Never ship hidden data "for the UI later" |
| Tampering (memory edits, forged packets) | The user controls the client and the network | Schema-validate every message; validate its meaning against server state (step 1). Client hardening only raises cost |
| Replay and duplication | The same request sent twice, or two requests racing | Rising sequence numbers per connection (step 1); idempotent, locked transactions for anything of value (step 4) |
| Botting | Scripted input from automation or a headless browser | Server-side behaviour statistics; client signals as weak features only; isolate flagged accounts (Detect, Enforce) |
| Economy abuse and real-money trading | Value farmed or moved between accounts | Append-only transfer ledger, graph tracing from one report, reversal of illicit transfers (step 4, Enforce) |
| Boosting and collusion (account sharing, win trading) | Accounts change hands or queue together to fix results | Policy in the terms; review of account and queue patterns; rank and reward reversion (Detect, Enforce) |

## Procedure

### 1. Validate every input on the server

Client checks are for feedback. The server repeats every check.

1. **Syntax.** Validate each message against its schema before anything reads it (TypeBox in `game-backend-architecture`). Use allowlists: known message types, known fields, bounded numbers and strings.
2. **Size.** Bun closes a WebSocket with code 1009 when a message exceeds `maxPayloadLength`, which defaults to 16 MB. Set it near your largest valid message. This value is this skill's rule; measure your messages.
3. **Order.** Each input carries a sequence number. Drop any number that is not higher than the last one processed on that connection (`acceptSequence`). This stops a naive replay of captured inputs (this skill's rule).
4. **Movement.** Take a direction, not a position. Re-run the move on the server with the server's speed limit and the world bounds (`simulateMove`). If the client predicts, compare its reported end position with yours: the server's result wins, a small error needs no correction, a large one gets a correction, and a jump past a teleport distance also raises a flag (`checkClaimedPosition`; the flag is this skill's rule).
5. **Clock.** Compute elapsed time from server timestamps. Unreal's movement component discards moves whose timestamp drifts too far from the server's and does most of its timing maths with the server's timestamps. Beyond that, this skill's rule: clamp the step each input claims, and charge it to a per-connection budget of simulated time that banks only a little idle time. A client that claims more input time than the server clock allows is running fast (`consumeInputTime`). Move with the step the budget returned, never the raw claim.
6. **Semantics.** In `validateAction`, check the value makes sense in the current state: cooldown ready, target in range and in line of sight, item owned, enough currency.
7. **Rate.** Cap messages per connection in memory (`takeMessage`): one socket lives on one instance, so a Redis round trip per message is waste (this skill's rule). Cap costly actions per player in Redis (`redis-game-patterns`, pattern 3).
8. **Record.** Every rejection or flag goes to the detection log with the player id from the session, never from the message. One rejection is often lag; a stream of them is evidence.

Copy `boilerplate/input-guards.ts` for steps 3, 4, 5 and 7. Its limits are placeholders, not sourced numbers.

### 2. Send each client only what it may know

Compute what each player can perceive on the server and send nothing else. VALORANT withholds an opponent behind a wall until they could become visible. To avoid pop-in it sends a little early, by growing each actor's bounds by its velocity times a look-ahead longer than expected ping, and it treats "maybe visible" as visible.

1. Build the per-client set with the area-of-interest grid in `game-state-sync` (step 8). The grid is a range filter only. For secrecy, follow it with a visibility test: line of sight, room or zone, fog of war, team.
2. Pick the look-ahead and err towards visible. A missed visibility is a gameplay bug every player sees; an extra entity is a small leak.
3. List every field in every outgoing message and ask who may know it: opponents' hands, unrevealed tiles, loot rolls before the drop, other players' cooldowns and resources, hidden spawns. Remove what the receiver may not know. This list is this skill's rule.
4. Per-client deltas cost CPU per viewer. Budget for it (this skill's rule).

### 3. Limit lag compensation

The server decides every hit. With lag compensation the server keeps past world states, rewinds targets to where the shooter saw them, and tests the hit there. The cost is that a target can be hit just after reaching cover.

1. Store history in `RollbackBuffer` (`game-state-sync`).
2. Cap how far back the server rewinds. Riot's example: without a cap, a player with 500 ms latency could kill you half a second after you moved behind cover.
3. Clamp the time a client claims for its action to between now minus the allowed rewind and now, where the allowed rewind is the smaller of the cap and that connection's measured latency plus the interpolation delay its client renders remote players with (`clampClaimedTime`). Clamping per connection is this skill's rule.
4. Validate the rest of the shot against server state: weapon ready, ammunition, line of sight at the rewound time.

### 4. Make transfers atomic and replay-safe

Dupes come from two requests racing or one request applied twice (this skill's rule).

1. Every operation that moves value (trade, gift, market sale, reward claim, craft) is one Postgres transaction. Follow the trade rule in `game-backend-architecture` ("What lives where"): lock both `players` rows with `SELECT ... FOR UPDATE` in id order, then change inventory and currencies.
2. Debit with the guarded `spendCurrency` and record each applied operation in `processed_events` in the same transaction (`postgres-game-schema`). A repeated operation id then fails on the primary key instead of paying twice.
3. Under Serializable isolation, retry on SQLSTATE `40001`, and treat nothing read as valid until the transaction commits.
4. Keep an append-only ledger of transfers with sender, receiver, amount, item and time. Enforcement needs it to trace a ring and reverse it (this skill's rule).
5. Check stack splits, trades and drop paths as dupe surfaces (`game-economy-design`, step 10).

## Detect

Detection runs on data the server already has. The client cannot fake what it never computes.

- **Statistics.** Log per-player features from the authoritative server: time from target becoming visible to hit, hit ratio by distance, regularity of input timing, rejection and flag counts from step 1. Compare each player with the population. Valve reports that a deep-learning model on server data, with no client-side instrumentation, detects cheating behaviour; most teams start with plain distributions (this skill's rule). Feed the events through `gameplay-analytics`.
- **Machine scores go to moderators.** Lichess's Irwin learns cheating patterns, marks suspects and helps moderators judge them. Use scores to rank a review queue, not to ban.
- **Replays.** Store inputs or snapshots for flagged matches so a reviewer can watch the match from the suspect's view (this skill's rule).
- **Reports.** Weight reports by the reporter's record; do not count them. Riot found that report precision rises with ranked standing. Store each report with the reporter's rank and past accuracy.
- **Decoys.** Activision's research describes entities only cheating players can perceive: a reaction to one is a strong signal. With step 2 in place, the server can send a decoy that an honest client would never be shown, then watch for aim or movement towards it. Use it to gather evidence, not as sole proof (this skill's rule).
- **Transaction graph.** CCP reports that one bot or real-money-trading report can lead through a web of transactions to a large ring. Query the ledger from step 4 outward from the flagged account (a recursive CTE in Postgres).
- **Boosting and collusion.** Review sudden changes in an account's device, region and skill together, and pairs of accounts that queue at the same moment and meet repeatedly with one-sided results. These are review signals, not bans (this skill's rule).

## Enforce

1. **Delay bans on purpose.** Riot does not ban at the moment of detection: an instant ban lets a cheat developer change the cheat, make an account and see if it gets banned. Run bans from a scheduled job with a random delay per detection, not inside the request handler (this skill's rule). Riot also let the least effective scripters run longer so that when and why they were caught stays unclear.
2. **Choose the action.** Account suspension or ban (`betterauth-integration`: the admin plugin's `banned`, `banReason`, `banExpires`; the session check runs once, so use the `kick` fan-out for open sockets). Rank and reward reversion. A restricted matchmaking pool: Riot pushed levelling bots into a queue where their low rating matched them against each other (in `matchmaking-system`, a separate pool key per trust tier). Browsers expose no stable hardware id, so plan account-level enforcement only (this skill's rule).
3. **Boosting and win trading.** VALORANT penalises booster, boostee and players queuing with them, reverts rank and rewards, bans permanently for repeated, severe abuse, and acts only on repeated patterns and strong evidence. It also states what stays allowed: mixed-rank premades, alt accounts you play yourself. Wild Rift runs win-trading ban waves without notice. Write your own allowed and forbidden list into the terms.
4. **Real-money trading.** CCP moved to daily bans to shrink the window for farming currency, reversed illicit transfers even when buyers' wallets went negative, and seized assets. Name in the terms what you may take back (currency from unofficial sellers, items, rank), so a reversal has a footing (this skill's rule).
5. **False positives.** Expect them. Show the ban reason at login, and give an appeal path that a human reviews; Riot shows the reason at login and takes appeals through a named ticket type. Restore a wrongly banned account fully, including rank and items (this skill's rule).
6. **Refund victims.** When a cheater is confirmed, undo what opponents lost. Lichess refunds rating to opponents who lost to a player marked as a cheater, within caps; Riot announced a Ranked Rollback for VALORANT that undoes ranked points lost to a banned cheater. Keep per-match rating deltas in match history so the job can compute refunds.

## What a browser client cannot protect

This section is this skill's rule; no source opened states it for browsers. The player controls the JavaScript engine, DevTools, extensions and the network. Everything in the bundle or in a received message can be read, and anything sent can be forged. Minifying or obfuscating the bundle raises the cost of reading it and protects nothing. Every rule lives on the server.

Client signals still worth logging, as weak features beside server data:
- `navigator.webdriver`, which is true when automation controls the browser.
- The share of input events with `isTrusted === false`; script-dispatched events and `HTMLElement.click()` set it to false.
- Focus and visibility changes, and input timing regularity.

The client can spoof each of these, so none is ban evidence alone. Send them as a game message; the server tracks them with the session's player id through `gameplay-analytics`. Read the privacy section before shipping any of them.

## Privacy and legal limits

- In the EU, Article 5(3) of the ePrivacy Directive covers reading information from a player's device. The EDPB's Guidelines 2/2023 (v2.0) put JavaScript that makes the browser send information clearly in scope, and say fingerprinting through context such as the user agent can trigger it. The only exemptions are transmission of a communication and what is strictly necessary for a service the user explicitly requested. The guidelines do not say whether anti-cheat collection meets that exemption.
- Data-protection law also applies to the detection data you store and to automated decisions such as bans. Check with counsel before shipping client-side collection or automated bans.
- Server-side telemetry of the inputs a player sends anyway is the lower-risk path (this skill's rule).

## Pitfalls

- Accepting a position, a hit, a score or a timestamp from the client.
- Treating the area-of-interest grid as secrecy. It filters by range; hidden entities inside the range still leak.
- Shipping hidden data "for later" in a payload, a bundle or a debug field.
- Banning inside the request handler, at the moment of detection.
- Banning on one signal, a report count or a client-side flag alone.
- Lag compensation with no rewind cap, or trusting the claimed fire time. Also the reverse: a per-connection rewind that leaves out the interpolation delay clamps and flags every honest shot.
- Read-modify-write on balances, or a reward claim with no idempotency key.
- Leaving `maxPayloadLength` at the 16 MB default.
- Copying another game's thresholds (ping caps, refund caps, ban lengths) as if they were rules; they fit that game.
- A ban that leaves victims' losses in place.

## Files

- `boilerplate/input-guards.ts`: copy when wiring server-side input checks: sequence check, movement re-simulation with speed and teleport tolerance, simulated-time budget with a capped idle bank, claimed-timestamp clamp, per-connection message budget. Pure functions with no imports; the limits are placeholders to tune.
- `references/sources.md`: read when you need the page behind a rule here.

## Related skills

- `game-state-sync` for the area-of-interest grid, sequence numbers and `RollbackBuffer`
- `game-backend-architecture` for the trade transaction and the `kick` fan-out
- `redis-game-patterns` for per-action rate limits
- `matchmaking-system` for separate pools per trust tier
- `gameplay-analytics` for the detection event pipeline
- `game-economy-design` for faucets, sinks and exploit review
- `betterauth-integration` for ban fields, moderator roles and session revocation
- `mmo-design` for griefing and anti-social play
