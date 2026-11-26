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
  const oracleQueue = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh');
  let p = await program.account.playerState.fetch(playerPda);
  console.log('before cancel pending', p.pendingRequest, 'packs', p.packsOpened.toString(), 'seed', p.requestSeed);
  if (p.pendingRequest) {
    const sig = await program.methods.cancelPack().accounts({ owner: payer.publicKey, player: playerPda }).rpc().catch((e) => { console.log('cancel rpc error', e.signature || e.message); return e.signature; });
    console.log('cancel_pack signature', sig);
    if (sig) { const c = await connection.confirmTransaction(sig, 'confirmed').catch(() => null); console.log('cancel confirm', c ? JSON.stringify(c.value) : 'timeout, check via CLI'); }
  }
  p = await program.account.playerState.fetch(playerPda);
  console.log('after cancel pending', p.pendingRequest, 'packs', p.packsOpened.toString());
  const seed = Math.floor(Math.random() * 256);
  const beforePacks = p.packsOpened.toString();
  const sig2 = await program.methods.openPack(seed).accounts({ payer: payer.publicKey, player: playerPda, oracleQueue }).rpc().catch((e) => { console.log('open rpc error', e.signature || e.message); return e.signature; });
  console.log('open_pack retry signature', sig2, 'seed', seed);
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const q = await program.account.playerState.fetch(playerPda);
    console.log('poll', i, 'pending', q.pendingRequest, 'packs', q.packsOpened.toString(), 'rarity', q.lastRarity);
    if (!q.pendingRequest && q.packsOpened.toString() !== beforePacks) {
      console.log('VRF CALLBACK LANDED rarity', q.lastRarity, 'randomness', Buffer.from(q.lastRandomness).toString('hex'));
      return;
    }
  }
  console.log('callback not seen in 120s');
}
main().catch((e) => { console.error('FAILED', e.message || e); process.exit(1); });
