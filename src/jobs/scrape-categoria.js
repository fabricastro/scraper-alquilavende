import { SCRAPE } from '../config.js';
import { fetchHtml, fetchListado } from '../scraping/http-client.js';
import { mapListadoRows } from '../scraping/listado-parser.js';
import { parseDetalle } from '../scraping/detalle-parser.js';

export const AVISO_STATUS = Object.freeze({
  NUEVO: 'nuevo',
  ACTUALIZADO: 'actualizado',
  SKIPPED: 'skipped',
  ERROR: 'error',
});

async function processAviso(listing, repo, logger) {
  const now = new Date();
  try {
    const existing = await repo.findById(listing._id);

    if (!existing) {
      const detailHtml = await fetchHtml(listing.url_original);
      const detalle = parseDetalle(detailHtml, listing._id);
      await repo.upsertFull(listing, detalle, now);
      return AVISO_STATUS.NUEVO;
    }

    if (repo.isFresh(existing, now)) {
      await repo.touchLastSeen(listing._id, now);
      return AVISO_STATUS.SKIPPED;
    }

    await repo.upsertListingOnly(listing, now);
    return AVISO_STATUS.ACTUALIZADO;
  } catch (err) {
    logger.error(`aviso ${listing._id}: ${err.message}`);
    return AVISO_STATUS.ERROR;
  }
}

function emptyStats() {
  return {
    nuevos: 0,
    actualizados: 0,
    skipped: 0,
    errores: 0,
    total: 0,
    nuevosListings: [],
  };
}

function tallyStatus(stats, status) {
  if (status === AVISO_STATUS.NUEVO) stats.nuevos++;
  else if (status === AVISO_STATUS.ACTUALIZADO) stats.actualizados++;
  else if (status === AVISO_STATUS.SKIPPED) stats.skipped++;
  else stats.errores++;
}

export async function scrapeCategoria(categoria, repo, parentLogger) {
  const log = parentLogger.child(categoria.nombre);
  const stats = emptyStats();
  let page = 1;
  // Distingue "categoría legítimamente sin más resultados" (rows.length === 0)
  // de "no pudimos ni preguntar" (tkn vencido, sesión, sitio caído, forma de
  // respuesta cambiada). Solo lo primero es un fin de categoría normal — lo
  // segundo tiene que hacer ruido en scrapeAll, no camuflarse como total:0.
  let fetchFailed = false;

  // Paginamos SIEMPRE hasta la primera página vacía: recorrer cada listado es
  // lo que refresca last_seen_at y mantiene vivo al aviso. Solo se hace el
  // fetch caro del detalle para avisos NUEVOS (ver processAviso). El tope
  // maxPagesPerCategoria es una salvaguarda contra loops, no un early-exit.
  while (page <= SCRAPE.maxPagesPerCategoria) {
    let data;
    try {
      data = await fetchListado({ cat: categoria.cat, pagina: page });
    } catch (err) {
      log.error(`Falló listado pagina=${page}: ${err.message}`);
      fetchFailed = true;
      break;
    }

    const listings = mapListadoRows(data.rows, categoria.nombre);
    if (listings.length === 0) {
      log.info(`Pagina ${page} vacía — fin de categoría`);
      break;
    }

    log.info(`Pagina ${page}: ${listings.length} avisos`);
    stats.total += listings.length;

    for (const listing of listings) {
      const status = await processAviso(listing, repo, log);
      tallyStatus(stats, status);
      if (status === AVISO_STATUS.NUEVO) {
        stats.nuevosListings.push(listing);
      }
    }

    page++;
  }

  if (page > SCRAPE.maxPagesPerCategoria) {
    log.error(
      `Tope de ${SCRAPE.maxPagesPerCategoria} páginas alcanzado en ${categoria.nombre} — ` +
        'posible loop de paginación o catálogo más grande de lo esperado'
    );
  }

  return { ...stats, fetchFailed };
}
