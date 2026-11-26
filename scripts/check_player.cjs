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
  const p = await program.account.playerState.fetch(playerPda);
  console.log(JSON.stringify({ player: playerPda.toBase58(), owner: p.owner.toBase58(), packsOpened: p.packsOpened.toString(), bestScore: p.bestScore.toString(), totalProfit: p.totalProfit.toString(), lastRarity: p.lastRarity, pendingRequest: p.pendingRequest, requestSeed: p.requestSeed, lastRandomness: Buffer.from(p.lastRandomness).toString('hex') }));
}
main().catch((e) => { console.error('CHECK FAILED', e.message || e); process.exit(1); });
