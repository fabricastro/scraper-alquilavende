import { HTTP, SCRAPE } from '../config.js';
import { fetchHtml } from '../scraping/http-client.js';
import { parseListado } from '../scraping/listado-parser.js';
import { parseDetalle } from '../scraping/detalle-parser.js';

export const AVISO_STATUS = Object.freeze({
  NUEVO: 'nuevo',
  ACTUALIZADO: 'actualizado',
  SKIPPED: 'skipped',
  ERROR: 'error',
});

function listingUrl(cat, page) {
  return `${HTTP.baseUrl}/b.php?cat=${cat}&pagina=${page}&orden=0&estado=Todos`;
}

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
  return { nuevos: 0, actualizados: 0, skipped: 0, errores: 0, total: 0 };
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
  let consecutivePagesWithoutNewAvisos = 0;

  while (true) {
    let html;
    try {
      html = await fetchHtml(listingUrl(categoria.cat, page));
    } catch (err) {
      log.error(`Falló listado pagina=${page}: ${err.message}`);
      break;
    }

    const listings = parseListado(html, categoria.nombre);
    if (listings.length === 0) {
      log.info(`Pagina ${page} vacía — fin de categoría`);
      break;
    }

    log.info(`Pagina ${page}: ${listings.length} avisos`);
    stats.total += listings.length;

    let nuevosEnPagina = 0;
    for (const listing of listings) {
      const status = await processAviso(listing, repo, log);
      tallyStatus(stats, status);
      if (status === AVISO_STATUS.NUEVO) nuevosEnPagina++;
    }

    if (nuevosEnPagina === 0) {
      consecutivePagesWithoutNewAvisos++;
      if (consecutivePagesWithoutNewAvisos >= SCRAPE.earlyExitEmptyPages) {
        log.info(
          `Early-exit: ${SCRAPE.earlyExitEmptyPages} páginas seguidas sin avisos nuevos`
        );
        break;
      }
    } else {
      consecutivePagesWithoutNewAvisos = 0;
    }

    page++;
  }

  return stats;
}
