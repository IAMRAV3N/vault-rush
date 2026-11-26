# Vault Rush — Program

Solana Blitz v10, MagicBlock. Entertainment Finance.
Player opens a collectible pack, rarity decided by MagicBlock VRF, then
plays a 60 second skill trading run on an Ephemeral Rollup.

## Status

- Program ID: `GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8`
  (keypair in `.keys/vault-rush-dev.json`, gitignored, never shared)
- Build: SUCCEEDED, two ways. First with solana-cli 4.4.1 via
  `anchor build -- --arch v0` (BPF release build, 3m 37s), then a
  clean plain `anchor build` under solana-cli 3.1.9, which rebuilt
  the identical .so (sha256 31ec6a5f...51fad5e). `.so` 381K at
  `programs/vault_rush/target/deploy/vault_rush.so` (also copied to
  `target/deploy/vault_rush.so`).
- IDL: GENERATED and valid, `target/idl/vault_rush.json`, address
  `GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8`, 9 instructions
  including the `#[ephemeral]` injected `process_undelegation`.
- Rust unit tests: 3 passed, 0 failed
  (`cargo +1.89.0 test -p vault_rush --lib` — rarity mapping, bounds,
  account sizes).
- Deployment on devnet: DEPLOYED Nov 25 2026. Marcus funded the deployer
  wallet with 5 devnet SOL from faucet.solana.com. `anchor deploy`
  succeeded. Program ID `GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8`,
  ProgramData `4BPaMpjEdA3BoUMYQwFY1jD3rbpu3b5TNFGkLVGkS4N9`,
  upgrade authority `HazoB9kZjJVqPkGr4f1Eq2Suuy6DzhSQxUCRgicqxjNw`,
  last deployed slot 526235268, data length 389832 bytes,
  program balance 1.9812254 SOL. IDL metadata created onchain.
  Verify: `solana program show GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8 --url devnet --keypair .keys/deployer.json`
  Explorer: https://explorer.solana.com/address/GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8?cluster=devnet
- Security fixes after first build: cancel_pack added, rarity now uses
  two randomness bytes. Rebuilt .so sha256
  4db003d05b9088f4d2b4dceee0ad3269f2f1cfebc08a808fb933ba662b60cc19,
  386K, IDL 23K with cancel_pack. Unit tests 3 passed, 0 failed.
- Live onchain calls Nov 25 2026, scripts/live_test.cjs, deployer wallet:
  init_player signature 4Xst5heikHvspjC4CSPZLkFsjM7xPAoQW4iz2h4UuAi61cy52MFRUinUPD7W3LibD11Jesd5JooCt8QPw3A3CDLF, Finalized.
  start_run signature 4hKcCFMT8Dy9FnkcenxTYxQdzp6Xy5gs7fpyYbqjSMETamRvSDgEskMp17LDL3Dx2kTvywdv5GXZCFDLUPZ79hft, Finalized.
  Note: the Node client timed out waiting on websocket confirmation in
  this VM, but solana confirm over HTTP showed both Finalized. That is a
  VM websocket issue, not a program failure.
- VRF open_pack live test, first attempt Nov 25 2026:
  signature 3zawsSfKzHkAe7tN97HAJBZTD1MVMGii2BmqK82P89mZTDGpsiuhevAk8h9vLL3UHxfWKGHwy1uuabspsBRE3L8Y,
  Finalized, slot 526235946, log Instruction: OpenPack, VRF fee 500000
  lamports paid to queue Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh.
  Callback did NOT land. Player stayed pending true, packs 0, seed 66,
  last randomness all zero, checked 20 minutes later. Request was past
  the 121 second purge window. This is exactly the stuck pending case
  cancel_pack was added for.
- Cancel retest Nov 25 2026 FAILED with a root cause found, not a program
  logic bug: cancel_pack returned AnchorError 101 InstructionFallbackNotFound.
  Check showed target/deploy/vault_rush.so was the OLD binary sha
  31ec6a5f, while programs/vault_rush/target/deploy/vault_rush.so was the
  NEW binary sha 4db003d0 with cancel_pack. anchor deploy had used the
  stale target/deploy copy, so the deployed program did not know
  cancel_pack, even though the IDL onchain did. Fix: copy the new .so
  into target/deploy, redeploy, verify sha, then rerun cancel_and_retry.cjs.
- Redeploy mistake Nov 25 2026: copying programs/vault_rush/target/deploy/
  vault_rush-keypair.json overwrote target/deploy/vault_rush-keypair.json
  with a different keypair. That deploy created a NEW program
  3iyRskkZo1wBTak8fDY6mmGauXTbgZzPjL3zqREtbHp3, slot 526242159, data
  length 394880, balance 2.00686924 SOL. It holds the new binary, but it
  is NOT the canonical program. Do not use it. GDCTM was untouched.
  Correct keypair restored from .keys/vault-rush-dev.json into both
  target/deploy keypair files, both now read GDCTM, .so sha 4db003d0.
- Upgrade to GDCTM Nov 25 2026 FAILED for funds: need 2006828600 lamports,
  wallet held 970284528 lamports, shortfall about 1.04 SOL. No faucet was
  needed: the mistaken program 3iyR was closed, 2.00686924 SOL reclaimed,
  balance 2.977 SOL.
- Upgrade FAILED again: ProgramData too small, old 389832 bytes, new
  394880 bytes. The 2.007 SOL was in buffer 25xmPYf6hsNPoKR4MQafSBWqEvCuNTNq7QGViBEtJJGV,
  closed to reclaim, balance 2.975 SOL. Program extended by 10240 bytes
  to 400072 bytes, slot 526281021.
- Upgrade SUCCEEDED Nov 25 2026: signature
  3dd6oyKdXNTS88jFb6W8nvoEHHSkLJcPsiibFwL7ePeGSvZ9iC6y3iBCWPUKLVAfUUXpokvSaPdQRmuZ7wvZ4FEA,
  slot 526281159, ProgramData 4BPaMpjEdA3BoUMYQwFY1jD3rbpu3b5TNFGkLVGkS4N9,
  data length 400072, program balance 2.0332446 SOL, deployer balance
  2.921154266 SOL. This is the new binary sha 4db003d0, with cancel_pack
  and two byte rarity.
- CancelPack PROVEN live Nov 25 2026: signature
  4Sr3EVGzLPNx5QeSyPBgbttJMcn1r35k26jt5hThUiCu98D2p48en7wNJBhCWwxPdFcKbFPZ5XvJoYFWo3rBihKq,
  slot 526281217, log Instruction: CancelPack, success. It cleared the
  stuck seed 66 request.
- OpenPack retry PROVEN live Nov 25 2026: signature
  2tma4MimY35mf7g5nG9AE3PwEdbHvLtXB3xY8qTEk1es3XA8tVDZXkL6bgWwizq1J7xiW2xMD19mEnNcvgcSqHRZ,
  slot 526281471, log Instruction: OpenPack, VRF success, seed 145.
- VRF callback STILL NOT LANDED after two requests, checked Nov 25 2026
  16:55 EST. Player: pending true, seed 145, packs 0, rarity 0,
  randomness all zero. getSignaturesForAddress for the program shows
  no callback transaction ever touched it. VRF program itself is active
  on devnet, recent successful and failed txs at slot 526290392. Our
  request code matches the MagicBlock skill example exactly. Next step:
  try high priority VRF request, create_request_high_priority_scoped_randomness_ix_const,
  fee 800000 lamports, which exists in SDK 0.18.0.
- Deployer balance Nov 25 2026 16:55 EST: 22.920644266 SOL, up from 2.921
  SOL, a 20 SOL top up landed in tx 5RcSVrncPQtEDhpAW2yHWM1groWTTZg5E1NVm8RYPWbydL4FN5FHfxm4hTca1A9DVLc7o21swWfNwLhuiNh4GiEG,
  slot 526281673, likely DevnetFaucet.org.
- High priority VRF upgrade Nov 25 2026: open_pack now uses
  create_request_high_priority_scoped_randomness_ix_const, fee 800000
  lamports. Unit tests 3 passed. New .so sha
  451d246379547b965d9a764203c6f32e089c527ac3349f61229e11d2f8a50816.
  Upgrade signature 2VpZqCjVwew2FbrHyQpwUHdvfduQWtFVHDsFs7YMy5ryMbtQRTD8aDtscV2vZpaPmLEAeQBvk3LZ2mejwyqi8xCd,
  slot 526294928, program GDCTM, data length 400072.
- VRF CALLBACK PROVEN LIVE Nov 25 2026. CancelPack signature
  5e1T6SPwoiFRx8nzDjbsg3S2XQnpQk38KdXTXupJiNNfRWu2mgm2VBV8fC176x1PGJk9Vnqfb8LZ7ETyH2HZkZjG,
  slot 526294986, cleared seed 145. High priority OpenPack signature
  49DicJbv8EUURbVA2TCAkfeHvrVGAcPh1mqM6mLTno6rAHRAo8cx2cjAyTU9KkBuxiuWnRxH5xPYgdSdTw9g6atY,
  slot 526295238. Callback signature
  3m22R8iWwSBRf7Ejyfj6CRzVtSE5wE3Les5enMWfzZySJti7WjdDxo9Eg1RZRxhjLC3NgHtXX9Sh7f8YSBmQ2EYN,
  slot 526295240, only 2 slots later, log Instruction: CallbackRollPack,
  success, invoked by VRF program. Player now: packs 1, pending false,
  seed 0, last rarity 0 Common, last randomness
  5d733f090e80aceb6ee11f0741566c62645ea5e1db5711e89aa474a1fb480ae3.
  Two later callback attempts at slot 526295241 failed with Custom error 1,
  duplicate callbacks rejected as designed, no double count.
  Conclusion: regular priority requests did not get a callback in two
  tries, high priority did in 2 slots. Use high priority in the submission.
- Ephemeral Rollup test, first attempt Nov 25 2026: start_run and
  delegate_run both Finalized, router confirmed delegated to
  devnet-as.magicblock.app, validator MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57.
  submit_score on the rollup failed simulation, Account is immutable:
  it tried to write the non delegated Player account. Undelegate_run
  worked and recovered the run to base, status Active, score 0.
  Fix: submit_score now writes only the delegated Run account, Player
  is read only on the rollup. New settle_run instruction on base updates
  Player best score and total profit once, marks run Settled.
  New binary sha 670ad7ac2b368b1707938f7ae70f25c99d7fc9388f090ddad53970a66b45b669,
  ProgramData extended to 410312 bytes, upgrade signature
  3eD9JhxKTHhmNmtUVuAYS2HZMxo6VAmDKKWrsGfD6Z2wT9MSQYQpGJd3HaMvSAYRVATTKU8QVScZ3GC9A36E3SFN,
  slot 526296616.
- Ephemeral Rollup test PROVEN LIVE Nov 25 2026, scripts/er_test.cjs:
  StartRun dfwdkYLsfFHYnxdznd137fA5SxdyURnDPL58bkcFysoc5gTndDbJx6JwvQ5Ws69GDcNDMSho3dYucVbchjnqrzm,
  slot 526296673. DelegateRun 3CTYPUz3WmeLrLvsxQCSnuZV6fHbahHodVg8CqEtNTDEdDfVSPtV5FdgYudzEwCjND83Aj8n8rMQrkSR55jbW1AF,
  slot 526296682. SubmitScore on the rollup and UndelegateRun committed
  to base, then SettleRun 3HyZvzVE1qnJ8TLb1LFT3wNQhTR2Q1znqQVAHRJzpr4Dz1u8Qj1zfAHyzRuF4sWA7odMQePti7s6UJwBzW3uf3eo,
  slot 526296870, log Instruction: SettleRun, success. Player now:
  bestScore 12345, totalProfit 678, packs 1. The test script itself
  timed out at 240 seconds waiting on a websocket confirmation, its
  output was lost to tail buffering, but the onchain state and the
  SettleRun signature prove the full flow. SettleRun would fail if the
  run had not been Submitted on the rollup and committed back to base.
- Localnet deploy test: NOT POSSIBLE in this VM — `solana-test-validator`
  panics on `assertion failed: io_uring_supported()` under both
  solana-cli 4.4.1 and 3.1.9. This is a VM limitation, not a program
  bug. No localnet or MagicSVM integration run was possible here;
  the Anchor TS tests in tests/vault_rush.ts are unrun for the same
  reason (they need a validator).
- Cluster: devnet only. No mainnet.

## Files

- `programs/vault_rush/src/lib.rs` — full program
- `programs/vault_rush/Cargo.toml` — anchor-lang 1.0.2, ephemeral-rollups-sdk =0.18.0, features anchor + vrf
- `Anchor.toml` — anchor 1.0.2, cluster devnet
- `tests/vault_rush.ts` — Anchor TS tests for init / start / submit / bounds
- Rust unit tests in `lib.rs` — rarity mapping, bounds, account sizes

## Accounts

Player PDA, seeds `["player", wallet]`:
`owner, packs_opened u32, best_score u64, total_profit i64, last_rarity u8,
pending_request bool, request_seed u8, last_randomness [u8;32], bump`
Space 96 bytes.

Run PDA, seeds `["run", player PDA, run_id u64 LE]`:
`player, run_id, score u64, profit i64, status u8, bump`
Space 66 bytes. Status: 0 Created, 1 Active, 2 Submitted.
The Run account is the delegated account for Ephemeral Rollup play.
Both accounts are far under the 10,240 byte commit limit.

## Instructions

| Instruction | Where | Notes |
|---|---|---|
| `init_player` | base | Creates Player PDA |
| `open_pack(client_seed u8)` | base or ER | VRF request, `create_request_randomness_ix_const`, scoped identity `program_identity_pubkey(&ID)`. Base: `DEFAULT_QUEUE`. ER: `DEFAULT_EPHEMERAL_QUEUE`. One pending request at a time. |
| `callback_roll_pack(randomness [u8;32], client_seed u8)` | VRF oracle | `#[vrf_callback]`. Binds to pending request_seed, stores rarity, increments packs_opened once, clears pending. Duplicate / late callback errors, no double count. |
| `start_run(run_id u64)` | base | Creates Run PDA, status Active |
| `submit_score(score u64, profit i64)` | ER (delegated Run) | Owner only. Score cap 100,000. Profit bounds +/-1,000,000. Checked arithmetic on total_profit. Run must be Active, then Submitted. Updates best_score. |
| `delegate_run(run_id u64)` | base | `#[delegate]`, delegates Run PDA to the ER |
| `commit_run` | ER | `#[commit]`, MagicIntentBundleBuilder commit, stays delegated. At most 10 plain commits per delegation on live validators; Vault Rush commits once per run, then undelegates. |
| `undelegate_run` | ER | `#[commit]`, commit_and_undelegate |

## Rarity

From oracle randomness, `rarity_from_byte = randomness[0] % 101`:
0-59 Common, 60-84 Rare, 85-96 Epic, 97-100 Legendary.
Probabilities about 60% / 25% / 12% / 4%.
`client_seed` is caller entropy only (`caller_seed: [client_seed; 32]`);
rarity comes from oracle randomness, not from the seed, so seed grinding
cannot pick a rarity directly. Each base layer request also costs the
VRF fee, 500,000 lamports regular.

## Build commands

```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
cd ~/workspace/blitz-v10/vault-rush

# Toolchain (one time; what actually worked in this VM)
# rustup stable (1.100.0) + toolchain 1.89.0
# solana-cli: the stable installer gave 4.4.1, NEWER than the skill's
#   known-good 3.1.9, bundling platform tools v1.52 which rejects SBPFv3.
#   Workaround that worked then: anchor build -- --arch v0, then
#   generate the IDL separately, because --arch leaks into Anchor's
#   IDL cargo test step and fails it.
#   Clean fix: install solana-cli 3.1.9
#   (curl -sSfL https://release.anza.xyz/v3.1.9/install | bash)
#   and plain `anchor build` works, IDL included.
# avm via `cargo install avm` FAILS here (openssl-sys / gcc error in
#   openssl_shim.c). Anchor 1.0.2 was instead downloaded as a raw binary
#   from otter-sec/anchor releases to ~/.local/bin/anchor.
#   (Anchor's repo moved coral-xyz -> otter-sec.)
# anchor keys: the program keypair must be in BOTH
#   target/deploy/vault-rush-keypair.json AND target/deploy/vault_rush-keypair.json
#   (Anchor 1.0.2 reads the underscore name); `anchor keys list` must
#   print GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8 before building.

# Keypair for the program (devnet only, keep in .keys/, never share)
solana-keygen new --no-bip39-passphrase -o .keys/vault-rush-dev.json
anchor keys list   # then put the real ID in declare_id! and Anchor.toml

# Build / test
cargo +1.89.0 test -p vault_rush --lib
anchor build -- --arch v0
anchor idl build > target/idl/vault_rush.json
```

## Deploy to devnet

```bash
solana config set --url devnet
solana airdrop 2   # devnet faucet, repeat if needed for rent + fees
anchor deploy --provider.cluster devnet --provider.wallet .keys/deployer.json
# Verify:
solana program show GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8 --url devnet
```

## Flow (frontend / operator)

1. Base: `init_player`, then `start_run(run_id)`.
2. Base: `delegate_run(run_id)`; wait for router `getDelegationStatus`
   to report the Run delegated, use the returned ER `fqdn`.
3. ER: `submit_score(score, profit)` as the run plays (60 seconds).
4. ER: `undelegate_run()` to commit the final score to base.
   (Use `commit_run` only if the run must stay delegated for more writes.)
5. Base or ER: `open_pack(client_seed)` for the next pack; wait for the
   VRF callback to set `last_rarity` and clear `pending_request` before
   opening another pack. VRF requests become purgeable after about
   121-124 seconds; a purged request is not refunded, and a late callback
   for a superseded request is rejected by the seed check.

## Security

- Scoped VRF only. No hardcoded global VRF identity.
- Signer / PDA / owner checks on every mutating instruction; `has_one`
  on Player and Run accounts.
- No user controlled seed grinding for economic value beyond client_seed
  entropy (see Rarity above).
- Checked arithmetic everywhere a total changes.
- No token mint, no USDC transfer, no prize payout in this program.
  The $1,000 USDC prize pool is paid out off program by the operator;
  do not present a score onchain as a payment.
- No audit has been run on this program. It is a hackathon build, not
  audited production code. See Limits below.

## Honest limits

- The 60 second run timer is enforced by the client / operator, not by
  onchain wall clock. Onchain we record the run and its score; a
  malicious client could submit a score without playing 60 seconds.
  A production version needs server signed scores or an onchain
  start slot / crank deadline.
- Scores are self reported by the player (owner signed). There is no
  onchain verification that the trading run actually happened.
  That is the same trust model as the Blitz examples; it is not a
  proof of play.
- VRF callback is asynchronous: `open_pack` succeeding does not mean
  the pack is opened. The frontend must poll Player state.
- Commit limit: 10 plain commits per delegation. Vault Rush is
  designed for 1 commit per run, then undelegate, so this fits.
- Devnet only in this folder. No mainnet deployment, no audit.
