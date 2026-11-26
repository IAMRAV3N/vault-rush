# Vault Rush security review

Date: Nov 25 2026. Reviewer: Muse, reading lib.rs and PROGRAM.md. No external audit. This is a hackathon review, not a production audit.

## Passes

1. Scoped VRF only. open_pack uses create_request_randomness_ix_const with program_identity_pubkey. Callback uses vrf_callback. No hardcoded global VRF identity.
2. One pending VRF request at a time. pending_request is set before the VRF call. Callback binds to request_seed, clears pending, increments packs_opened once. Duplicate or late callback errors, no double count.
3. Owner checks. init_player, open_pack, start_run, submit_score, delegate, commit, undelegate all check owner or has_one owner. PDA seeds are player and run with run_id.
4. Bounds and checked arithmetic. Score cap 100000, profit bounds plus or minus 1000000, checked_add on total_profit and packs_opened.
5. Account size. Player 96 bytes, Run 66 bytes, both far under the 10240 byte commit limit.
6. No token mint, no USDC transfer, no prize payout in the program. No private key material in the repo. Keypairs are gitignored in .keys.

## Findings

1. Stuck pending request. If a VRF request is purged after about 121 seconds, pending_request stays true and the player cannot open another pack. There is no cancel path in the current build. Fix needed: add an owner only cancel_pack instruction that clears pending and seed. A late callback after cancel must still error, which it does, because pending is false.
2. Rarity bias, minor. rarity_from_byte uses one byte mod 101. Bytes 0 to 255 do not divide evenly by 101, so Common is slightly overweighted. Fix needed: use two randomness bytes as a u16, which cuts the bias to under 0.1 percent, or use rejection sampling.
3. Self reported scores. submit_score is owner signed, with no onchain proof that a 60 second run happened. The timer is client enforced. A malicious client can submit a high score without playing. This is the same trust model as the Blitz examples, but do not present a score as proof of play. Production fix: server signed scores, or an onchain start slot plus crank deadline.
4. Test queues allowed. open_pack accepts DEFAULT_TEST_QUEUE and DEFAULT_EPHEMERAL_TEST_QUEUE as well as the devnet queues. Fine for devnet, but restrict to the devnet queues only before any mainnet use.
5. Commit status not checked. commit_run does not check Run status. Harmless in this design, one commit per run then undelegate, but add a status check in a production pass.
6. No audit. VRF program itself was audited by Zenith in Aug 2025 and ARDA in Sep 2026, per the MagicBlock skill. Vault Rush program has not been audited.

## Tests run

Rust unit tests: 3 passed, 0 failed, rarity mapping, bounds, account sizes.
BPF build: succeeded, .so 381K, sha256 31ec6a5f, IDL valid, 9 instructions.
Anchor TS tests: unrun, they need a validator. Local validator panics on io_uring in this VM.
Deployment: not deployed, devnet wallet holds 0 SOL, faucet rate limited.

## Verdict

Build quality is solid for a hackathon MVP, with clear bounds and VRF handling. It is not ready to call audited or proof of play. Fix finding 1 and 2 before submit, and keep the honest limits in the submission.
