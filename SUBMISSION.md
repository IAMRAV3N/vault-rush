# Vault Rush submission pack

Entertainment Finance, MagicBlock. Submitted to Solana Blitz v10 before the 9:00 AM EST deadline on Fri Nov 27, 2026.

## Project

Name: Vault Rush
Theme: Entertainment Finance
One line: Open a VRF pack, then trade a live index in a 60 second skill run on an Ephemeral Rollup.

## Links in the submission

Live app: https://iamrav3n.github.io/vault-rush/
GitHub repo: https://github.com/IAMRAV3N/vault-rush
Walkthrough video, 78 seconds: https://raw.githubusercontent.com/IAMRAV3N/vault-rush/main/vault-rush-walkthrough.mp4
Program: https://explorer.solana.com/address/GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8?cluster=devnet
Build stage: https://build.magicblock.app/?stage=blitz&event=17
Event: https://luma.com/hedv5sgh
Code: this folder, `programs/vault_rush/src/lib.rs`, plus README.md, PROGRAM.md, SECURITY_REVIEW.md

## MagicBlock integration

Ephemeral Rollup: Run account delegated, `submit_score` runs on the rollup, `undelegate_run` commits to base, `settle_run` updates Player totals once on base.
VRF: `open_pack` requests randomness with the high priority scoped request, 800000 lamports, DEFAULT_QUEUE on base. Callback with `vrf_callback`, binds to the pending request seed, increments packs opened once. Regular priority requests were accepted twice with no callback, high priority landed in 2 slots, so the submission uses high priority.
Private Ephemeral Rollup: not used. Pack contents are revealed by the VRF callback, not hidden in a TEE in this version. Do not claim PER use.

## Live proofs on devnet

VRF callback slot 526295240, 2 slots after the high priority request, player packs 1, rarity Common. Second pack callback slot 526846243, player packs 2.
Ephemeral Rollup loop: StartRun slot 526296673, DelegateRun slot 526296682, SettleRun slot 526296870. Player best score 12345, total profit 678.
Program ID: `GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8`, latest upgrade slot 526296616.

## Status now

Web app: live, wired to the onchain program, wallet connect for Phantom, Solflare and Backpack.
Program: deployed live on devnet, VRF callback and Ephemeral Rollup loop both proven, see README.md.
Features: relic gallery, run history, activity feed, pack odds, leaderboard filters, OHLC and live profit and loss, sound, share.
Audit: none. Do not claim audited.
