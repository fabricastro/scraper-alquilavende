const LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };

function format(level, scope, msg) {
  const ts = new Date().toISOString();
  const scopeTag = scope ? ` [${scope}]` : '';
  return `[${ts}] [${level}]${scopeTag} ${msg}`;
}

export function createLogger(scope = '') {
  return {
    info: (msg) => console.log(format(LEVELS.INFO, scope, msg)),
    warn: (msg) => console.warn(format(LEVELS.WARN, scope, msg)),
    error: (msg) => console.error(format(LEVELS.ERROR, scope, msg)),
    child: (subScope) =>
      createLogger(scope ? `${scope}/${subScope}` : subScope),
  };
}

export const logger = createLogger();
