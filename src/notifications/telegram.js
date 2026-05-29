import { TELEGRAM } from '../config.js';
import { sleep } from '../utils/sleep.js';

const API_BASE = 'https://api.telegram.org';

export function isConfigured() {
  return Boolean(TELEGRAM.botToken && TELEGRAM.chatId);
}

// Telegram parse_mode=HTML solo interpreta un set acotado de tags.
// Escapamos los caracteres reservados en el texto que viene del sitio.
// También escapamos `"` para que las URLs raras no rompan el atributo href.
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Quita los tags HTML que usamos en el resumen y devuelve las entities a su
// forma original. Se usa como fallback si Telegram rechaza el parse HTML.
function stripHtml(text) {
  return String(text ?? '')
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function formatAviso(aviso) {
  const titulo = escapeHtml(aviso.titulo || 'Sin título');
  const contexto = [aviso.operacion, aviso.zona].filter(Boolean).join(', ');
  const contextoTag = contexto ? ` <i>(${escapeHtml(contexto)})</i>` : '';
  const precio = escapeHtml(aviso.precio_texto || 'Consultar');
  const link = aviso.url_original
    ? ` — <a href="${escapeHtml(aviso.url_original)}">ver aviso</a>`
    : '';
  return `• <b>${titulo}</b>${contextoTag}\n  ${precio}${link}`;
}

export function formatResumen(nuevos, now = new Date()) {
  // Tomamos día y mes en la TZ de Argentina vía formatToParts y aplicamos el
  // padding a mano: la locale es-AR ignora `2-digit` para el mes en algunos
  // runtimes (Node 22 devuelve "5" en vez de "05").
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/San_Juan',
  }).formatToParts(now);
  const get = (type) => (parts.find((p) => p.type === type)?.value ?? '').padStart(2, '0');
  const fecha = `${get('day')}/${get('month')}`;

  const header = `🏠 <b>${nuevos.length} nuevo${
    nuevos.length === 1 ? '' : 's'
  } inmueble${nuevos.length === 1 ? '' : 's'}</b> — ${fecha}`;

  const listed = nuevos.slice(0, TELEGRAM.maxListedAvisos);
  const lines = listed.map(formatAviso);

  // Armamos el mensaje respetando el límite de Telegram (4096 chars).
  // Si nos pasamos, vamos descartando avisos del final y actualizamos
  // el footer "…y N más". Así nunca cortamos en medio de un tag HTML.
  const buildText = (visibleLines) => {
    const restantes = nuevos.length - visibleLines.length;
    const footer = restantes > 0 ? [`…y ${restantes} más`] : [];
    return [header, '', ...visibleLines, ...footer].join('\n');
  };

  let text = buildText(lines);
  while (text.length > TELEGRAM.maxMessageLength && lines.length > 0) {
    lines.pop();
    text = buildText(lines);
  }
  return text;
}

async function postMessage(text, { useHtml = true } = {}) {
  const url = `${API_BASE}/bot${TELEGRAM.botToken}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM.chatId,
    text,
    disable_web_page_preview: true,
  };
  if (useHtml) payload.parse_mode = 'HTML';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TELEGRAM.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Telegram respondió ${res.status}: ${body}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
}

// Detecta el error específico de parseo de HTML para fallback a texto plano.
function isParseEntitiesError(err) {
  return err?.status === 400 && /can't parse entities/i.test(err.body || '');
}

// Reintenta ante fallos de red o 5xx (timeouts intermitentes de la red/ISP).
// Un 4xx (token o chat_id inválido) no se reintenta: no se arregla solo.
// Excepción: si Telegram rechaza por HTML mal formado, reintentamos UNA vez
// como texto plano para no perder la notificación.
async function sendMessage(text, log) {
  let lastErr;
  for (let attempt = 1; attempt <= TELEGRAM.maxRetries; attempt++) {
    try {
      await postMessage(text, { useHtml: true });
      return;
    } catch (err) {
      lastErr = err;
      if (isParseEntitiesError(err)) {
        log.warn(
          `Telegram no pudo parsear el HTML (${err.body?.slice(0, 200)}). Reintento como texto plano.`
        );
        await postMessage(stripHtml(text), { useHtml: false });
        return;
      }
      if (err.status >= 400 && err.status < 500) throw err;
      if (attempt < TELEGRAM.maxRetries) {
        const wait = TELEGRAM.retryBackoffMs * attempt;
        log.warn(
          `Envío a Telegram falló (intento ${attempt}/${TELEGRAM.maxRetries}): ${err.message}. Reintento en ${wait}ms`
        );
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

// Envía el resumen de avisos nuevos. Si Telegram no está configurado o no hay
// avisos, no hace nada. Un fallo en el envío se loguea pero NO interrumpe la
// corrida del scraper.
export async function notifyNuevos(nuevos, log) {
  if (!isConfigured()) {
    log.info('Telegram no configurado — se omite la notificación');
    return;
  }
  if (!nuevos || nuevos.length === 0) {
    log.info('Sin avisos nuevos — no se envía notificación');
    return;
  }

  try {
    await sendMessage(formatResumen(nuevos), log);
    log.info(`Notificación de Telegram enviada (${nuevos.length} nuevos)`);
  } catch (err) {
    log.error(`No se pudo enviar la notificación de Telegram: ${err.message}`);
  }
}
