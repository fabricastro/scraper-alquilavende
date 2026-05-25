import { SCRAPE } from '../config.js';

export function createAvisosRepository(collection) {
  return {
    findById(id) {
      return collection.findOne({ _id: id });
    },

    isFresh(doc, now = new Date()) {
      if (!doc?.scraped_at) return false;
      const age = now.getTime() - new Date(doc.scraped_at).getTime();
      return age < SCRAPE.freshnessThresholdMs;
    },

    async touchLastSeen(id, now = new Date()) {
      await collection.updateOne(
        { _id: id },
        { $set: { last_seen_at: now, activo: true } }
      );
    },

    async upsertListingOnly(listing, now = new Date()) {
      const { _id, ...listingData } = listing;
      await collection.updateOne(
        { _id },
        {
          $set: { ...listingData, last_seen_at: now, activo: true },
          $setOnInsert: { created_at: now, scraped_at: null },
        },
        { upsert: true }
      );
    },

    async upsertFull(listing, detalle, now = new Date()) {
      const { _id, ...listingData } = listing;
      await collection.updateOne(
        { _id },
        {
          $set: {
            ...listingData,
            ...detalle,
            scraped_at: now,
            last_seen_at: now,
            activo: true,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true }
      );
    },

    async markInactiveStale(staleDays = SCRAPE.staleAfterDays, now = new Date()) {
      const cutoff = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);
      const result = await collection.updateMany(
        { last_seen_at: { $lt: cutoff }, activo: { $ne: false } },
        { $set: { activo: false } }
      );
      return result.modifiedCount;
    },
  };
}
