import { HTTP } from '../config.js';

const BASE_URL = HTTP.baseUrl;

const CURRENCY_MAP = {
  'U$S': 'USD',
  $: 'ARS',
};

export function absoluteUrl(relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const clean = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  return `${BASE_URL}/${clean}`;
}

// `row.ruta` es "rubro,categoria,operacion,zona" (ids), y `row.Categoria` es un
// dict { [id]: { description, url } } con la descripción humana de cada nivel.
// Ej: ruta="1,104,10403,1040320" → Categoria["10403"].description = "Venta",
// Categoria["1040320"].description = "Zonda" (departamento de San Juan).
function resolveBreadcrumb(row) {
  const codes = String(row.ruta || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const catalogo = row.Categoria || {};
  const describe = (code) => catalogo[code]?.description ?? null;

  return {
    operacion: describe(codes[2]) || null,
    zona: describe(codes[3]) || null,
  };
}

// `row.precio` ya viene numérico (como string, ej "24500.00"). precio "0.00"
// es la convención del sitio para "Consultar" (ver buildPublication en el JS
// del sitio: `pub.precio != 0 ? ... : "Consultar"`).
function mapPrecio(row) {
  const monto = Number(row.precio);
  if (!monto) {
    return { precio: null, moneda: 'CONSULTAR', precio_texto: 'Consultar' };
  }

  const moneda = CURRENCY_MAP[row.moneda] ?? 'CONSULTAR';
  const simbolo = row.moneda === 'U$S' ? 'U$S' : row.moneda === '$' ? '$' : '';
  return {
    precio: monto,
    moneda,
    precio_texto: `${simbolo}${monto.toLocaleString('de-DE')}`,
  };
}

// `fchact_original` ya es una fecha/hora completa ("2026-07-03 15:50:59"),
// mucho más confiable que parsear el texto relativo ("hace 2h") de `fchact`.
function parseFechaActualizacion(fechaOriginal) {
  if (!fechaOriginal) return null;
  const d = new Date(fechaOriginal.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Mapea `data.rows` de la respuesta de /api/busqueda al shape que espera
// `processAviso` en scrape-categoria.js. `categoryFallback` es el nombre de
// categoría de `CATEGORIAS` en config.js (ya sabemos qué categoría pedimos,
// no hace falta derivarla del JSON — y así evitamos discrepancias de texto,
// ej. API dice "Terrenos, Lotes" pero el enum del proyecto es "Terrenos/Lotes").
export function mapListadoRows(rows, categoryFallback) {
  const items = [];
  const seen = new Set();

  for (const row of rows || []) {
    const id = String(row.cod_pub || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const { operacion, zona } = resolveBreadcrumb(row);
    const { precio, moneda, precio_texto } = mapPrecio(row);

    items.push({
      _id: id,
      titulo: String(row.titulo || '').trim(),
      categoria: categoryFallback || null,
      operacion,
      zona,
      precio_texto,
      precio,
      moneda,
      thumbnail: absoluteUrl(row.url_foto),
      fecha_actualizacion_texto: row.fchact || null,
      fecha_actualizacion: parseFechaActualizacion(row.fchact_original),
      url_original: absoluteUrl(row.url),
    });
  }

  return items;
}
