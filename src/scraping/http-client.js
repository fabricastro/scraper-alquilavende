import axios from 'axios';
import pLimit from 'p-limit';
import { HTTP } from '../config.js';
import { sleep } from '../utils/sleep.js';

const limit = pLimit(1);
let lastRequestAt = 0;

function decodeLatin1(buffer) {
  return Buffer.from(buffer).toString('latin1');
}

export async function fetchHtml(url) {
  return limit(async () => {
    const wait = HTTP.crawlDelayMs - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let lastError;
    for (let attempt = 1; attempt <= HTTP.maxRetries; attempt++) {
      try {
        const res = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': HTTP.userAgent,
            'Accept-Language': HTTP.acceptLanguage,
          },
          timeout: HTTP.timeoutMs,
        });
        return decodeLatin1(res.data);
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
