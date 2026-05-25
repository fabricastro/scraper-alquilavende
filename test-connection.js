import 'dotenv/config';
import { connect, close } from './src/db.js';

console.log('Conectando a MongoDB Atlas...');

try {
  const { client, collection } = await connect();
  console.log('[OK] Conexión establecida');

  const indexes = await collection.indexes();
  console.log(`[OK] Índices creados: ${indexes.length}`);
  for (const idx of indexes) {
    console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
  }

  const count = await collection.countDocuments();
  console.log(`[OK] Documentos actuales en la collection: ${count}`);

  await close(client);
  console.log('[OK] Todo listo, conexión cerrada.');
  process.exit(0);
} catch (err) {
  console.error('[ERROR]', err.message);
  if (err.code === 8000 || /authentication/i.test(err.message)) {
    console.error('  → Revisá usuario/password en MONGODB_URI');
  } else if (/ENOTFOUND|getaddrinfo/i.test(err.message)) {
    console.error('  → Revisá el hostname del cluster (la parte después de @)');
  } else if (/IP|whitelist/i.test(err.message)) {
    console.error('  → Tu IP no está autorizada. Andá a Atlas → Network Access');
  }
  process.exit(1);
}
