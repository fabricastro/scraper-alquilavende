import * as cheerio from 'cheerio';
import { HTTP } from '../config.js';

const BASE_URL = HTTP.baseUrl;

function extractFotos(html, avisoId) {
  const re = new RegExp(`fotos_inmuebles\\/${avisoId}_(\\d+)\\.jpg`, 'g');
  const ids = new Set();
  for (const m of html.matchAll(re)) ids.add(m[1]);
  return [...ids]
    .sort((a, b) => Number(a) - Number(b))
    .map((n) => `${BASE_URL}/fotos_inmuebles/${avisoId}_${n}.jpg`);
}

const ACCENT_RE = /[̀-ͯ]/g;

function normalizeKey(label) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(ACCENT_RE, '')
    .replace(/:/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

// Solo las claves listadas acá se promueven a campos top-level del documento.
// El resto queda en `caracteristicas` raw.
const PROMOTED_KEYS = {
  superficie_total: 'superficie_total_m2',
  superficie_cubierta: 'superficie_cubierta_m2',
  dormitorios: 'dormitorios',
  banos: 'banos',
  ambientes: 'ambientes',
  garages: 'garages',
  antiguedad: 'antiguedad',
  apto_credito: 'apto_credito',
  en_barrio_privado: 'barrio_privado',
};

const NUMERIC_FIELDS = new Set([
  'superficie_total_m2',
  'superficie_cubierta_m2',
  'dormitorios',
  'banos',
  'ambientes',
  'garages',
]);

const BOOLEAN_FIELDS = new Set(['apto_credito', 'barrio_privado']);

function parseCaracteristicaValue(raw, targetField) {
  const v = (raw || '').trim();
  if (!v || /sin especificar/i.test(v)) return null;

  if (NUMERIC_FIELDS.has(targetField)) {
    const m = v.match(/\d+(?:[.,]\d+)?/);
    return m ? Number(m[0].replace(',', '.')) : null;
  }
  if (BOOLEAN_FIELDS.has(targetField)) {
    if (/^si$/i.test(v)) return true;
    if (/^no$/i.test(v)) return false;
    return null;
  }
  return v;
}

function extractCaracteristicas($) {
  const raw = {};
  const promoted = {};

  $('p.name-caracteristica').each((_, el) => {
    const $p = $(el);
    const value = $p.find('span.caracteristica').first().text().trim();
    const label = $p
      .clone()
      .children('span')
      .remove()
      .end()
      .text()
      .replace(/:$/, '')
      .trim();
    if (!label) return;

    const normKey = normalizeKey(label);
    if (raw[normKey] !== undefined) return;
    raw[normKey] = value;

    const promotedKey = PROMOTED_KEYS[normKey];
    if (promotedKey) {
      promoted[promotedKey] = parseCaracteristicaValue(value, promotedKey);
    }
  });

  return { caracteristicas: raw, ...promoted };
}

function extractContacto($) {
  // El `<a href="tel:...">` está afuera de `#telefono_contacto`
  // (ese contenedor carga por AJAX cuando se clickea "Ver Teléfono").
  const telHref = $('a[href^="tel:"]').first().attr('href');
  const tel = telHref ? telHref.replace(/^tel:/, '').trim() : null;

  const waHref = $('a[href*="api.whatsapp.com/send"]').first().attr('href');
  let whatsapp = null;
  if (waHref) {
    const m = waHref.match(/phone=(\d+)/);
    whatsapp = m ? m[1] : null;
  }

  const nombre = $('p.anunciante a').first().text().trim() || null;

  return { tel, whatsapp, nombre };
}

function extractDescripcion($) {
  const $desc = $('p.comentario-caracteristicas-anuncio').first();
  $desc.find('br').replaceWith('\n');
  return $desc.text().trim();
}

export function parseDetalle(html, avisoId) {
  const $ = cheerio.load(html);

  return {
    descripcion: extractDescripcion($),
    fotos: extractFotos(html, avisoId),
    contacto: extractContacto($),
    ...extractCaracteristicas($),
  };
}
