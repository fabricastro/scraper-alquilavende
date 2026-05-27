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
  // Cuántas páginas consecutivas sin avisos NUEVOS toleramos antes de
  // dar la categoría por terminada. Evita falsos positivos por destacados
  // que empujan abajo los avisos nuevos genuinos.
  earlyExitEmptyPages: 2,
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

export const TELEGRAM = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || null,
  chatId: process.env.TELEGRAM_CHAT_ID || null,
  // Telegram limita cada mensaje a 4096 caracteres.
  maxMessageLength: 4096,
  // Cantidad máxima de avisos a listar en el resumen; el resto se cuenta aparte.
  maxListedAvisos: 30,
  timeoutMs: 15_000,
  // Reintentos ante fallos de red o errores 5xx (timeouts intermitentes).
  maxRetries: 3,
  retryBackoffMs: 2_000,
};
