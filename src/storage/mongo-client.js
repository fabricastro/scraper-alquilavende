import { MongoClient } from 'mongodb';
import { MONGO } from '../config.js';

async function ensureIndexes(collection) {
  await collection.createIndex({ scraped_at: -1 });
  await collection.createIndex({ last_seen_at: -1 });

  // Filtro maestro: operación + categoría + zona (cubre las queries más comunes).
  await collection.createIndex({
    operacion: 1,
    categoria: 1,
    zona: 1,
    activo: 1,
  });

  // Precio siempre por moneda para no mezclar USD con ARS.
  await collection.createIndex({ moneda: 1, precio: 1, activo: 1 });

  // Filtros por características.
  await collection.createIndex({ dormitorios: 1 });
  await collection.createIndex({ banos: 1 });
  await collection.createIndex({ superficie_total_m2: 1 });
  await collection.createIndex({ barrio_privado: 1 });
  await collection.createIndex({ apto_credito: 1 });

  // Búsqueda full-text sobre título + descripción (en español).
  await collection.createIndex(
    { titulo: 'text', descripcion: 'text' },
    { default_language: 'spanish', name: 'fulltext_titulo_descripcion' }
  );
}

export async function connect() {
  if (!MONGO.uri) {
    throw new Error('MONGODB_URI no está definida en .env');
  }

  const client = new MongoClient(MONGO.uri);
  await client.connect();
  const collection = client.db(MONGO.dbName).collection(MONGO.collectionName);

  await ensureIndexes(collection);

  return { client, collection };
}

export async function close(client) {
  if (client) await client.close();
}
