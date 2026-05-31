import 'dotenv/config';

export const HTTP = {
  baseUrl: 'https://www.compraensanjuan.com',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  acceptLanguage: 'es-AR,es;q=0.9',
  timeoutMs: 30_000,
  // robots.txt declara Crawl-delay: 5. Sumamos 0.5s de margen.
  crawlDelayMs: 5_500,
  maxRetries: 3,
  retryBackoffMs: 2_000,
};

export const SCRAPE = {
  freshnessThresholdMs: 23 * 60 * 60 * 1000,
  staleAfterDays: 7,
  // Tope de seguridad por categoría. La paginación corta de forma natural al
  // llegar a una página vacía; este límite solo evita un loop infinito si el
  // sitio dejara de devolver páginas vacías al final.
  //
  // IMPORTANTE: paginamos SIEMPRE hasta agotar resultados. Refrescar
  // last_seen_at de cada aviso existente (recorriendo su listado) es lo que lo
  // mantiene activo. El viejo early-exit "tras N páginas sin avisos nuevos"
  // congelaba el last_seen_at de las páginas profundas, y markInactiveStale
  // terminaba dándolas de baja: así se perdió ~80% del catálogo.
  maxPagesPerCategoria: 300,
};

export const CATEGORIAS = [
  { cat: 100, nombre: 'Casas' },
  { cat: 102, nombre: 'Departamentos' },
  { cat: 104, nombre: 'Terrenos/Lotes' },
  { cat: 106, nombre: 'Locales/Oficinas/Salones' },
  { cat: 108, nombre: 'Fincas/Campos/Quintas' },
  { cat: 110, nombre: 'Negocios/Industrias' },
  { cat: 111, nombre: 'Cocheras' },
  { cat: 112, nombre: 'Galpones' },
];

export const CRON = {
  schedule: '0 3 * * *',
  timezone: 'America/Argentina/San_Juan',
};

export const MONGO = {
  uri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || 'inmuebles_sj',
  collectionName: process.env.COLLECTION_NAME || 'avisos',
};

// Frontend público. Los links "ver aviso" del resumen de Telegram apuntan acá
// (no al sitio scrapeado): https://www.alquilavende.com.ar/aviso/<id>
export const PUBLIC_SITE = {
  baseUrl: 'https://www.alquilavende.com.ar',
};

export const TELEGRAM = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || null,
  chatId: process.env.TELEGRAM_CHAT_ID || null,
  // Telegram limita cada mensaje a 4096 caracteres. El resumen lista tantos
  // avisos nuevos como entren hasta ese límite; el resto se cuenta en "…y N más".
  maxMessageLength: 4096,
  timeoutMs: 15_000,
  // Reintentos ante fallos de red o errores 5xx (timeouts intermitentes).
  maxRetries: 3,
  retryBackoffMs: 2_000,
};
