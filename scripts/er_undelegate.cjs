const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { GetCommitmentSignature } = require('@magicblock-labs/ephemeral-rollups-sdk');
async function sendTx(connection, tx, payer) {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  console.log('sent', sig);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await connection.getSignatureStatuses([sig]);
    const st = s.value[0];
    if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) {
      console.log('confirmed', sig, st.confirmationStatus, 'err', st.err);
      if (st.err) throw new Error('tx failed ' + JSON.stringify(st.err));
      return sig;
    }
    if (st && st.err) throw new Error('tx failed ' + JSON.stringify(st.err));
  }
  throw new Error('tx not confirmed in 60s ' + sig);
}
async function main() {
  const root = path.resolve(__dirname, '..');
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'target/idl/vault_rush.json'), 'utf8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, '.keys/deployer.json'), 'utf8'))));
  const baseConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const provider = new anchor.AnchorProvider(baseConnection, new anchor.Wallet(payer), { commitment: 'confirmed' });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider);
  const [playerPda] = PublicKey.findProgramAddressSync([Buffer.from('player'), payer.publicKey.toBuffer()], program.programId);
  const runId = new anchor.BN(process.argv[2]);
  const [runPda] = PublicKey.findProgramAddressSync([Buffer.from('run'), playerPda.toBuffer(), runId.toArrayLike(Buffer, 'le', 8)], program.programId);
  console.log('run_id', runId.toString(), 'run PDA', runPda.toBase58());
  const erConnection = new Connection('https://devnet-as.magicblock.app/', 'confirmed');
  const erProvider = new anchor.AnchorProvider(erConnection, new anchor.Wallet(payer), { commitment: 'confirmed' });
  const erProgram = new anchor.Program(idl, erProvider);
  const tx = await erProgram.methods.undelegateRun().accounts({ payer: payer.publicKey, player: playerPda, run: runPda }).transaction();
  const sig = await sendTx(erConnection, tx, payer);
  console.log('undelegate done', sig);
  try { const cs = await GetCommitmentSignature(sig, erConnection); console.log('commitment base sig', cs); } catch (e) { console.log('commit sig note', e.message); }
  await new Promise((r) => setTimeout(r, 5000));
  const run = await program.account.runState.fetch(runPda);
  console.log('run on BASE status', run.status, 'score', run.score.toString(), 'profit', run.profit.toString());
}
main().catch((e) => { console.error('FAILED', e.message || e); process.exit(1); });
