import { CATEGORIAS } from '../config.js';
import { logger } from '../utils/logger.js';
import { notifyNuevos } from '../notifications/telegram.js';
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
  const nuevosListings = [];
  let categoriasConResultados = 0;
  let categoriasConFetchFailed = 0;

  for (const categoria of CATEGORIAS) {
    logger.info(`--- Categoría: ${categoria.nombre} (cat=${categoria.cat}) ---`);
    const stats = await scrapeCategoria(categoria, repo, logger);
    logger.info(summarizeCategoria(categoria.nombre, stats));
    for (const k of Object.keys(totals)) totals[k] += stats[k];
    nuevosListings.push(...stats.nuevosListings);
    if (stats.total > 0) categoriasConResultados++;
    if (stats.fetchFailed) categoriasConFetchFailed++;
  }

  // Página 1 vacía en UNA categoría puede ser legítimo (categoría chica sin
  // stock). Pero TODAS las categorías en 0 el mismo día es la firma de una
  // falla sistémica (ej. el sitio cambió el parsing/endpoint del listado y
  // dejamos de extraer avisos silenciosamente — ya pasó una vez, ver
  // markInactiveStale). Un fetch fallido (tkn/sesión/forma de respuesta) en
  // CUALQUIER categoría es la misma señal, aunque el resto de categorías haya
  // andado bien ese día — no hay que esperar a que fallen todas para avisar.
  // Esto tiene que ser imposible de pasar por alto en los logs de GH Actions,
  // así que además de loguear, se marca el proceso como fallido.
  const fallaSistemica = categoriasConResultados === 0 || categoriasConFetchFailed > 0;
  if (fallaSistemica) {
    logger.error(
      `¡ALERTA! categoriasConResultados=${categoriasConResultados} ` +
        `categoriasConFetchFailed=${categoriasConFetchFailed} de ${CATEGORIAS.length}. ` +
        'Esto es anómalo: probablemente el sitio cambió el parsing/endpoint ' +
        'del listado y el scraper está extrayendo listados vacíos (o fallando) ' +
        'en silencio. Revisar antes de que markInactiveStale empiece a dar de ' +
        'baja el catálogo.'
    );
    process.exitCode = 1;
  }

  logger.info('--- Marcando avisos zombies (no vistos > 7 días) ---');
  const inactivados = await repo.markInactiveStale();
  logger.info(`Marcados como inactivos: ${inactivados}`);

  await notifyNuevos(nuevosListings, logger);

  const durationMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
  logger.info(`=== Scraper terminado en ${durationMin} min ===`);
  logger.info(`Totales: ${JSON.stringify(totals)} | Inactivados: ${inactivados}`);

  return { ...totals, inactivados };
}
