# Vault Rush submission pack

Entertainment Finance, MagicBlock.

## Project

Name: Vault Rush
Theme: Entertainment Finance
One line: Open a VRF pack, then trade a live index in a 60 second skill run on an Ephemeral Rollup.

## Links to include in the submission

Live app: Vault Rush web app, wired to the live program below
Program: https://explorer.solana.com/address/GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8?cluster=devnet
Build stage: https://build.magicblock.app/?stage=blitz&event=17
Event: https://luma.com/hedv5sgh
Code: this folder, `programs/vault_rush/src/lib.rs`, plus README.md, PROGRAM.md, SECURITY_REVIEW.md

## MagicBlock integration

Ephemeral Rollup: Run account delegated, `submit_score` runs on the rollup, `undelegate_run` commits to base, `settle_run` updates Player totals once on base.
VRF: `open_pack` requests randomness with the high priority scoped request, 800000 lamports, DEFAULT_QUEUE on base. Callback with `vrf_callback`, binds to the pending request seed, increments packs opened once. Regular priority requests were accepted twice with no callback, high priority landed in 2 slots, so the submission uses high priority.
Private Ephemeral Rollup: not used. Pack contents are revealed by the VRF callback, not hidden in a TEE in this version. Do not claim PER use.

## What to submit

Title: Vault Rush
Description: A real time Entertainment Finance arena on Solana. VRF pack opening plus a 60 second skill trading run on an Ephemeral Rollup, with a live leaderboard.
Repo link: upload this folder to a public repo before submitting, then paste that link.
Live link: paste the Vault Rush app link.
Video: record a 60 to 90 second walkthrough, pack open, run, leaderboard, wallet connect.

## Status now

Web app: live, wired to the onchain program, wallet connect for Phantom, Solflare and Backpack.
Program: deployed live on devnet, slot 526296616, VRF callback and Ephemeral Rollup loop both proven, see README.md.
Audit: none. Do not claim audited.
