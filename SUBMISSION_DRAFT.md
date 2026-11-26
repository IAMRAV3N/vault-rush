# Vault Rush submission draft, ready to paste

Title: Vault Rush
One line: Open a VRF pack, then trade a live index in a 60 second skill run on an Ephemeral Rollup.

Description: Vault Rush is a real time Entertainment Finance arena on Solana. Connect a wallet, open a collectible pack where rarity is decided by MagicBlock VRF, then play a 60 second skill trading run on an Ephemeral Rollup, with a live leaderboard. Built with Anchor and the MagicBlock Ephemeral Rollups SDK 0.18.0.

MagicBlock integration: Ephemeral Rollup, Run account delegated, submit_score on the rollup, undelegate and settle_run back to base. VRF, open_pack with high priority scoped randomness, callback binds to the pending request and sets rarity once.

Program ID, devnet: GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8
Explorer: https://explorer.solana.com/address/GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8?cluster=devnet

Repo link: TODO, push this folder to a public GitHub repo first
Live link: Vault Rush app
Video link: TODO, 60 to 90 second walkthrough

Proven live: VRF callback landed 2 slots after the high priority request, slot 526295240. Ephemeral Rollup loop, StartRun slot 526296673, DelegateRun slot 526296682, SettleRun slot 526296870, player best score 12345, total profit 678.

Honest limits: no audit, scores are owner reported, 60 second timer is client enforced, Private Ephemeral Rollups are not used.
