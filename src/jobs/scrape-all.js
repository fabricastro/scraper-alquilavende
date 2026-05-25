import { CATEGORIAS } from '../config.js';
import { logger } from '../utils/logger.js';
import { scrapeCategoria } from './scrape-categoria.js';

function emptyTotals() {
  return { nuevos: 0, actualizados: 0, skipped: 0, errores: 0, total: 0 };
}

function summarizeCategoria(nombre, stats) {
  return (
    `[${nombre}] Total: ${stats.total} | ` +
    `Nuevos: ${stats.nuevos} | Actualizados: ${stats.actualizados} | ` +
    `Skipped: ${stats.skipped} | Errores: ${stats.errores}`
  );
}

export async function scrapeAll(repo) {
  const startedAt = Date.now();
  logger.info('=== Scraper iniciado ===');

  const totals = emptyTotals();

  for (const categoria of CATEGORIAS) {
    logger.info(`--- Categoría: ${categoria.nombre} (cat=${categoria.cat}) ---`);
    const stats = await scrapeCategoria(categoria, repo, logger);
    logger.info(summarizeCategoria(categoria.nombre, stats));
    for (const k of Object.keys(totals)) totals[k] += stats[k];
  }

  logger.info('--- Marcando avisos zombies (no vistos > 7 días) ---');
  const inactivados = await repo.markInactiveStale();
  logger.info(`Marcados como inactivos: ${inactivados}`);

  const durationMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
  logger.info(`=== Scraper terminado en ${durationMin} min ===`);
  logger.info(`Totales: ${JSON.stringify(totals)} | Inactivados: ${inactivados}`);

  return { ...totals, inactivados };
}
