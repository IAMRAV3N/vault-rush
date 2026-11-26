# Vault Rush

A real time Entertainment Finance arena on Solana. Open a collectible pack, rarity decided by MagicBlock VRF, then play a 60 second skill trading run on an Ephemeral Rollup. Relic value plus trading profit combine into one score on the arena leaderboard.

## Live app

Vault Rush web app, wired to the live program below. Connect a Solana wallet on devnet, open a pack, play a run, climb the leaderboard.

## Program

Program ID, devnet only: `GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8`

Explorer: https://explorer.solana.com/address/GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8?cluster=devnet

Status: deployed and live on devnet, latest upgrade slot 526296616, ProgramData 410312 bytes. See PROGRAM.md for the full deployment and testing log.

Source: `programs/vault_rush/src/lib.rs`, Anchor 1.0.2, `ephemeral-rollups-sdk` 0.18.0 with features `anchor` and `vrf`.

Tests: Rust unit tests, 3 passed, 0 failed. Anchor TS tests in `tests/vault_rush.ts` are unrun, they need a local validator, which is unavailable in this environment.

IDL: `target/idl/vault_rush.json`, 11 instructions including `settle_run` and `cancel_pack`.

## How to play

1. Connect a Solana wallet on devnet.
2. Create a player account with `init_player` if you do not have one.
3. Open a pack. One high priority VRF request at a time. Wait for the callback to set rarity, or use `cancel_pack` to clear a stuck request.
4. Start a run. Delegate the Run account to the Ephemeral Rollup.
5. Trade the VAULT index for 60 seconds. Buy low, sell high, mind position size.
6. Submit the score on the Ephemeral Rollup, then undelegate to commit it back to base, then `settle_run` to update your Player totals once.
7. Climb the leaderboard. Best score and total profit are stored on the Player account.

## Rarity

Common about 60 percent, Rare about 25 percent, Epic about 12 percent, Legendary about 4 percent. Rarity comes from oracle randomness, the first two randomness bytes as a u16 modulo 101, not from the client seed.

## Proven live on devnet

- VRF pack opening, high priority, 800000 lamports: callback landed 2 slots after the request, slot 526295240, player packs 1, rarity Common. Duplicate callbacks are rejected as designed.
- Ephemeral Rollup loop: StartRun slot 526296673, DelegateRun slot 526296682 to devnet-as.magicblock.app, submit_score on the rollup, undelegate back to base, SettleRun slot 526296870. Player then read best score 12345, total profit 678.

## Honest limits

Scores are owner reported. The 60 second timer is client enforced, not onchain wall clock. No audit has been run. This is a hackathon build, not audited production code. Private Ephemeral Rollups are not used. See SECURITY_REVIEW.md and PROGRAM.md.
