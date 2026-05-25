import * as cheerio from 'cheerio';
import { HTTP } from '../config.js';

const BASE_URL = HTTP.baseUrl;

export function parsePrecio(rawText) {
  const text = (rawText || '').trim();
  if (!text || /consultar/i.test(text)) {
    return {
      precio: null,
      moneda: 'CONSULTAR',
      precio_texto: text || 'Consultar',
    };
  }

  let moneda;
  if (/u\$|usd|us\$/i.test(text)) moneda = 'USD';
  else if (/\$/.test(text)) moneda = 'ARS';
  else moneda = 'CONSULTAR';

  const digits = text.replace(/[^\d]/g, '');
  const precio = digits ? Number(digits) : null;
  return { precio, moneda, precio_texto: text };
}

export function parseFechaActualizacion(rawText, referenceDate = new Date()) {
  const t = (rawText || '').trim().toLowerCase();
  if (!t) return null;

  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (t.includes('hoy')) return startOfDay(referenceDate);
  if (t.includes('ayer')) {
    const d = startOfDay(referenceDate);
    d.setDate(d.getDate() - 1);
    return d;
  }

  const hoursMatch = t.match(/hace\s+(\d+)\s*h/);
  if (hoursMatch) {
    const d = new Date(referenceDate);
    d.setHours(d.getHours() - Number(hoursMatch[1]));
    return d;
  }

  const dateMatch = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    const [, dd, mm, yy] = dateMatch;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return new Date(year, Number(mm) - 1, Number(dd));
  }

  return null;
}

export function absoluteUrl(relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const clean = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  return `${BASE_URL}/${clean}`;
}

function extractAvisoId(href) {
  const m = (href || '').match(/anuncio_in\/(\d+)/);
  return m ? m[1] : null;
}

// Cada aviso aparece duplicado en el HTML (vista desktop + vista mobile).
// Filtramos por el contenedor desktop `.row.lista-avisos` y dedupeamos por _id.
export function parseListado(html, categoryFallback) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('.row.lista-avisos').each((_, el) => {
    const $row = $(el);
    const $titleLink = $row.find('a.title.orange-link').first();
    const href = $titleLink.attr('href');
    const id = extractAvisoId(href);
    if (!id || seen.has(id)) return;
    seen.add(id);

    const breadcrumbs = $row
      .find('a.categoria.orange-link')
      .map((_, a) => $(a).text().trim())
      .get()
      .filter(Boolean);

    const categoria = breadcrumbs[1] || categoryFallback || null;
    const operacion = breadcrumbs[2] || null;
    const zona = breadcrumbs[3] || null;

    const precioRaw = $row.find('.precio').first().text().trim();
    const { precio, moneda, precio_texto } = parsePrecio(precioRaw);

    const fechaRaw = $row.find('.tiempo-creado').first().text().trim();
    const thumbRaw = $row.find('img.img-lista').first().attr('src');

    items.push({
      _id: id,
      titulo: $titleLink.text().trim(),
      categoria,
      operacion,
      zona,
      precio_texto,
      precio,
      moneda,
      thumbnail: absoluteUrl(thumbRaw),
      fecha_actualizacion_texto: fechaRaw,
      fecha_actualizacion: parseFechaActualizacion(fechaRaw),
      url_original: absoluteUrl(href),
    });
  });

  return items;
}
