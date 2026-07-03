import axios from 'axios';
import pLimit from 'p-limit';
import { HTTP } from '../config.js';
import { sleep } from '../utils/sleep.js';

// Single global limiter: serializa TODAS las requests salientes (listado HTML,
// api/busqueda y detalle) para respetar el mismo Crawl-delay de robots.txt,
// sin importar cuántos requests distintos componen un flujo.
const limit = pLimit(1);
let lastRequestAt = 0;

function decodeLatin1(buffer) {
  return Buffer.from(buffer).toString('latin1');
}

async function rateLimitedRequest(config) {
  return limit(async () => {
    const wait = HTTP.crawlDelayMs - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let lastError;
    for (let attempt = 1; attempt <= HTTP.maxRetries; attempt++) {
      try {
        return await axios({
          timeout: HTTP.timeoutMs,
          headers: {
            'User-Agent': HTTP.userAgent,
            'Accept-Language': HTTP.acceptLanguage,
            ...config.headers,
          },
          ...config,
        });
      } catch (err) {
        lastError = err;
        if (attempt < HTTP.maxRetries) {
          await sleep(HTTP.retryBackoffMs * attempt);
        }
      }
    }
    throw lastError;
  });
}

export async function fetchHtml(url) {
  const res = await rateLimitedRequest({
    method: 'get',
    url,
    responseType: 'arraybuffer',
  });
  return decodeLatin1(res.data);
}

function extractTkn(html) {
  const m = html.match(/"tkn"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const values = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const value of values) {
    const m = value.match(/PHPSESSID=[^;]+/);
    if (m) return m[0];
  }
  return null;
}

// El sitio renderiza el listado por AJAX contra /api/busqueda. Ese endpoint
// exige un `tkn` de un solo uso, embebido en la respuesta HTML de la página
// de listado (`GET /b.php?...`) y atado al `Set-Cookie: PHPSESSID` de ESA
// respuesta puntual — no es una sesión reutilizable. Por eso el flujo es
// SIEMPRE de 2 requests secuenciales, ambos pasando por el mismo rate limiter:
//   1) GET /b.php?cat=...&pagina=...  → extraer tkn + PHPSESSID frescos
//   2) GET /api/busqueda con esos mismos filtros + tkn + Cookie
export async function fetchListado({ cat, pagina, orden = '0', estado = 'Todos' }) {
  const listingUrl = `${HTTP.baseUrl}/b.php`;
  const listingRes = await rateLimitedRequest({
    method: 'get',
    url: listingUrl,
    params: { cat, pagina, orden, estado },
    responseType: 'arraybuffer',
  });

  const html = decodeLatin1(listingRes.data);
  const tkn = extractTkn(html);
  const cookie = extractSessionCookie(listingRes.headers['set-cookie']);
  if (!tkn || !cookie) {
    throw new Error(
      `No se pudo extraer tkn/PHPSESSID del listado (cat=${cat} pagina=${pagina})`
    );
  }

  const apiRes = await rateLimitedRequest({
    method: 'get',
    url: `${HTTP.baseUrl}/api/busqueda`,
    params: {
      texto: '',
      pagina,
      cat,
      foto: false,
      envio: false,
      precio: false,
      orden,
      estado,
      tkn,
    },
    headers: { Cookie: cookie },
  });

  const body = apiRes.data;
  if (!body || body.ok !== true) {
    throw new Error(
      `api/busqueda respondió error (cat=${cat} pagina=${pagina}): ${
        body?.error || body?.msg || 'respuesta inesperada'
      }`
    );
  }
  if (!Array.isArray(body.data?.rows)) {
    throw new Error(
      `api/busqueda respondió ok pero sin data.rows (cat=${cat} pagina=${pagina}) — ` +
        'el sitio pudo haber cambiado la forma de la respuesta'
    );
  }

  return body.data; // { total, rows, categories, ... }
}
