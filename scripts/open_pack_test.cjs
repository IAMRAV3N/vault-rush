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
  const seed = Math.floor(Math.random() * 256);
  console.log('player', playerPda.toBase58(), 'seed', seed);
  const before = await program.account.playerState.fetch(playerPda);
  console.log('before packs', before.packsOpened.toString(), 'pending', before.pendingRequest);
  let sig;
  try {
    sig = await program.methods.openPack(seed).accounts({ payer: payer.publicKey, player: playerPda, oracleQueue }).rpc();
    console.log('open_pack signature', sig);
  } catch (e) {
    console.log('open_pack rpc error, signature if any:', e.signature || e.message);
    sig = e.signature;
    if (!sig) throw e;
  }
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const p = await program.account.playerState.fetch(playerPda);
    console.log('poll', i, 'pending', p.pendingRequest, 'packs', p.packsOpened.toString(), 'rarity', p.lastRarity);
    if (!p.pendingRequest && p.packsOpened.toString() !== before.packsOpened.toString()) {
      console.log('VRF CALLBACK LANDED, rarity', p.lastRarity, 'last_randomness', Buffer.from(p.lastRandomness).toString('hex').slice(0, 32));
      return;
    }
  }
  console.log('callback not seen in 120s, check later with solana confirm', sig);
}
main().catch((e) => { console.error('OPEN PACK FAILED', e.message || e); process.exit(1); });
