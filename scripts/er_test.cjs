const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { GetCommitmentSignature, DELEGATION_PROGRAM_ID } = require('@magicblock-labs/ephemeral-rollups-sdk');

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

async function getDelegationStatus(account) {
  const res = await fetch('https://devnet-router.magicblock.app/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getDelegationStatus', params: [account.toBase58()] }) });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
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
  const runId = new anchor.BN(Math.floor(Math.random() * 1000000000));
  const [runPda] = PublicKey.findProgramAddressSync([Buffer.from('run'), playerPda.toBuffer(), runId.toArrayLike(Buffer, 'le', 8)], program.programId);
  console.log('run_id', runId.toString(), 'run PDA', runPda.toBase58());
  let tx = await program.methods.startRun(runId).accounts({ owner: payer.publicKey, player: playerPda, run: runPda, systemProgram: anchor.web3.SystemProgram.programId }).transaction();
  await sendTx(baseConnection, tx, payer);
  console.log('start_run done');
  tx = await program.methods.delegateRun(runId).accounts({ payer: payer.publicKey, player: playerPda, run: runPda }).transaction();
  await sendTx(baseConnection, tx, payer);
  console.log('delegate_run done');
  let fqdn = null;
  for (let i = 0; i < 30; i++) {
    const st = await getDelegationStatus(runPda);
    console.log('delegation poll', i, JSON.stringify(st));
    if (st.isDelegated && st.fqdn) { fqdn = st.fqdn; break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!fqdn) throw new Error('run never delegated');
  const erEndpoint = fqdn.startsWith('http') ? fqdn : 'https://' + fqdn;
  console.log('ER endpoint', erEndpoint);
  const erConnection = new Connection(erEndpoint, 'confirmed');
  const erProvider = new anchor.AnchorProvider(erConnection, new anchor.Wallet(payer), { commitment: 'confirmed' });
  const erProgram = new anchor.Program(idl, erProvider);
  tx = await erProgram.methods.submitScore(new anchor.BN(12345), new anchor.BN(678)).accounts({ owner: payer.publicKey, player: playerPda, run: runPda }).transaction();
  await sendTx(erConnection, tx, payer);
  console.log('submit_score on ER done');
  let run = await erProgram.account.runState.fetch(runPda);
  console.log('run on ER score', run.score.toString(), 'profit', run.profit.toString(), 'status', run.status);
  tx = await erProgram.methods.undelegateRun().accounts({ payer: payer.publicKey, player: playerPda, run: runPda }).transaction();
  const undelegateSig = await sendTx(erConnection, tx, payer);
  console.log('undelegate_run on ER done', undelegateSig);
  try {
    const commitSig = await GetCommitmentSignature(undelegateSig, erConnection);
    console.log('commitment base signature', commitSig);
    await baseConnection.confirmTransaction(commitSig, 'confirmed');
  } catch (e) { console.log('GetCommitmentSignature note', e.message); }
  await new Promise((r) => setTimeout(r, 5000));
  run = await program.account.runState.fetch(runPda);
  console.log('run on BASE after undelegate score', run.score.toString(), 'profit', run.profit.toString(), 'status', run.status);
  tx = await program.methods.settleRun().accounts({ owner: payer.publicKey, player: playerPda, run: runPda }).transaction();
  await sendTx(baseConnection, tx, payer);
  console.log('settle_run on BASE done');
  run = await program.account.runState.fetch(runPda);
  console.log('run on BASE after settle score', run.score.toString(), 'profit', run.profit.toString(), 'status', run.status);
  const player = await program.account.playerState.fetch(playerPda);
  console.log('player bestScore', player.bestScore.toString(), 'totalProfit', player.totalProfit.toString(), 'packs', player.packsOpened.toString());
  console.log('ER TEST PASSED');
}
main().catch((e) => { console.error('ER TEST FAILED', e.message || e); process.exit(1); });
