# Vault Rush — Anchor test (devnet / localnet, read the notes first)
#
# What this covers on base, without a live VRF oracle or ER:
#   init_player, start_run, submit_score (bounds + owner + status),
#   double submit rejected, over-cap score rejected.
# What it does NOT cover (needs MagicSVM / devnet ER + VRF oracle):
#   open_pack -> VRF callback, delegate_run, commit_run, undelegate_run.
# Those are exercised in tests/magicsvm.rs (Rust, see PROGRAM.md) and
# manually on devnet with the commands in PROGRAM.md.
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VaultRush } from "../target/types/vault_rush";
import { assert } from "chai";

describe("vault_rush", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VaultRush as Program<VaultRush>;
  const owner = provider.wallet.publicKey;

  const [playerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player"), owner.toBuffer()],
    program.programId
  );
  const runId = new anchor.BN(1);
  const [runPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("run"),
      playerPda.toBuffer(),
      runId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  it("inits a player", async () => {
    await program.methods
      .initPlayer()
      .accounts({ payer: owner, player: playerPda })
      .rpc();
    const p = await program.account.playerState.fetch(playerPda);
    assert.equal(p.owner.toBase58(), owner.toBase58());
    assert.equal(p.packsOpened, 0);
    assert.isFalse(p.pendingRequest);
  });

  it("starts a run and submits a score", async () => {
    await program.methods
      .startRun(runId)
      .accounts({ owner, player: playerPda, run: runPda })
      .rpc();
    await program.methods
      .submitScore(new anchor.BN(4200), new anchor.BN(150))
      .accounts({ owner, player: playerPda, run: runPda })
      .rpc();
    const r = await program.account.runState.fetch(runPda);
    assert.equal(r.score.toNumber(), 4200);
    assert.equal(r.profit.toNumber(), 150);
    assert.equal(r.status, 2);
    const p = await program.account.playerState.fetch(playerPda);
    assert.equal(p.bestScore.toNumber(), 4200);
    assert.equal(p.totalProfit.toNumber(), 150);
  });

  it("rejects a second submit on the same run", async () => {
    try {
      await program.methods
        .submitScore(new anchor.BN(1), new anchor.BN(1))
        .accounts({ owner, player: playerPda, run: runPda })
        .rpc();
      assert.fail("second submit should have failed");
    } catch (e: any) {
      assert.include(String(e), "InvalidRunStatus");
    }
  });

  it("rejects an over-cap score", async () => {
    const runId2 = new anchor.BN(2);
    const [run2] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("run"),
        playerPda.toBuffer(),
        runId2.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    await program.methods
      .startRun(runId2)
      .accounts({ owner, player: playerPda, run: run2 })
      .rpc();
    try {
      await program.methods
        .submitScore(new anchor.BN(100_001), new anchor.BN(0))
        .accounts({ owner, player: playerPda, run: run2 })
        .rpc();
      assert.fail("over-cap score should have failed");
    } catch (e: any) {
      assert.include(String(e), "ScoreTooHigh");
    }
  });
});
