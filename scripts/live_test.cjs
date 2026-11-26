const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'target/idl/vault_rush.json'), 'utf8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, '.keys/deployer.json'), 'utf8'))));
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), { commitment: 'confirmed' });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider);
  const [playerPda] = PublicKey.findProgramAddressSync([Buffer.from('player'), payer.publicKey.toBuffer()], program.programId);
  console.log('program', program.programId.toBase58());
  console.log('payer', payer.publicKey.toBase58());
  console.log('player PDA', playerPda.toBase58());
  let player = null;
  try { player = await program.account.playerState.fetch(playerPda); } catch (e) { console.log('player not found yet, will init'); }
  if (!player) {
    const sig = await program.methods.initPlayer().accounts({ payer: payer.publicKey, player: playerPda, systemProgram: anchor.web3.SystemProgram.programId }).rpc();
    console.log('init_player signature', sig);
    await connection.confirmTransaction(sig, 'confirmed');
  } else {
    console.log('player already exists, packs_opened', player.packsOpened.toString());
  }
  player = await program.account.playerState.fetch(playerPda);
  console.log('player owner', player.owner.toBase58(), 'packs', player.packsOpened.toString(), 'best', player.bestScore.toString(), 'profit', player.totalProfit.toString());
  const runId = new anchor.BN(Date.now() % 1000000);
  const [runPda] = PublicKey.findProgramAddressSync([Buffer.from('run'), playerPda.toBuffer(), runId.toArrayLike(Buffer, 'le', 8)], program.programId);
  const sig2 = await program.methods.startRun(runId).accounts({ owner: payer.publicKey, player: playerPda, run: runPda, systemProgram: anchor.web3.SystemProgram.programId }).rpc();
  console.log('start_run signature', sig2, 'run_id', runId.toString(), 'run PDA', runPda.toBase58());
  const run = await program.account.runState.fetch(runPda);
  console.log('run status', run.status, 'score', run.score.toString());
  console.log('explorer program https://explorer.solana.com/address/' + program.programId.toBase58() + '?cluster=devnet');
  console.log('explorer init https://explorer.solana.com/tx/' + (player ? '' : '') + '?cluster=devnet');
}
main().catch((e) => { console.error('LIVE TEST FAILED', e); process.exit(1); });
