// Run once to create a VAPID keypair for this deployment:
//   node scripts/generate-vapid.mjs
// Then store the values as Worker secrets (see server/README.md) — never
// commit them to the repo.
import { generateVAPIDKeys } from 'web-push-neo';

const keys = await generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('\nKeep VAPID_PRIVATE_KEY secret. VAPID_PUBLIC_KEY is also embedded in the client (fetched from /api/vapid-public-key), so it is not secret.');
