import cron from 'node-cron';
import { CRON } from './config.js';
import { connect, close } from './storage/mongo-client.js';
import { createAvisosRepository } from './storage/avisos-repository.js';
import { scrapeAll } from './jobs/scrape-all.js';
import { logger } from './utils/logger.js';

let isRunning = false;

async function runOnce() {
  if (isRunning) {
    logger.warn('Ya hay una corrida en progreso, salteando esta ejecución');
    return null;
  }
  isRunning = true;

  let client;
  try {
    const conn = await connect();
    client = conn.client;
    const repo = createAvisosRepository(conn.collection);
    return await scrapeAll(repo);
  } finally {
    await close(client);
    isRunning = false;
  }
}

function registerShutdown(scheduledTask) {
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Recibida señal ${signal}, cerrando...`);
    if (scheduledTask) scheduledTask.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main() {
  const runMode = process.argv.includes('--once') ? 'once' : 'cron';

  if (runMode === 'once') {
    await runOnce();
    return;
  }

  logger.info(`Cron programado: "${CRON.schedule}" (${CRON.timezone})`);
  const task = cron.schedule(
    CRON.schedule,
    async () => {
      try {
        await runOnce();
      } catch (err) {
        logger.error(`Corrida programada falló: ${err.message}`);
      }
    },
    { timezone: CRON.timezone }
  );

  registerShutdown(task);
}

main().catch((err) => {
  logger.error(`Error fatal: ${err.message}`);
  process.exit(1);
});

export { runOnce as runScraper };
