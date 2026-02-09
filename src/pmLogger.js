const crypto = require('crypto');

const fetchImpl = global.fetch || require('node-fetch');

const SENSITIVE_META_KEY = /(token|secret|password|authorization|api[-_]?key|cookie)/i;

function parseBoolean(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {};
  }
  const clean = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_META_KEY.test(key)) {
      clean[key] = '[MASKED]';
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function getCorrelationId(meta) {
  const existing = meta && typeof meta.correlationId === 'string' ? meta.correlationId.trim() : '';
  if (existing) return existing;
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPmLogger(options = {}) {
  const env = options.env || process.env;
  const baseUrl = (options.pmUrl || env.PM_URL || '').trim().replace(/\/$/, '');
  const ingestToken = (options.ingestToken || env.PM_INGEST_TOKEN || '').trim();
  const testEnabled = parseBoolean(options.testEnabled ?? env.PM_TEST_ENABLED, false);
  const testToken = (options.testToken || env.PM_TEST_TOKEN || '').trim();
  const enabled = Boolean(baseUrl && ingestToken);
  const state = {
    lastSend: null,
    hooksInstalled: false,
  };

  async function send(level, message, meta) {
    const normalizedMeta = normalizeMeta(meta);
    const correlationId = getCorrelationId(normalizedMeta);
    normalizedMeta.correlationId = correlationId;

    const requestMeta = {
      at: new Date().toISOString(),
      level: String(level || 'info'),
      ok: false,
      statusCode: null,
      correlationId,
      skipped: false,
    };

    if (!enabled) {
      requestMeta.ok = false;
      requestMeta.skipped = true;
      requestMeta.error = 'disabled';
      state.lastSend = requestMeta;
      return { ok: false, skipped: true, correlationId };
    }

    try {
      const response = await fetchImpl(`${baseUrl}/api/logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ingestToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: requestMeta.level,
          message: message == null ? '' : String(message),
          meta: normalizedMeta,
        }),
      });
      requestMeta.statusCode = response.status;
      requestMeta.ok = response.ok;
      if (!response.ok) {
        requestMeta.error = `status_${response.status}`;
      }
      state.lastSend = requestMeta;
      return { ok: response.ok, correlationId, statusCode: response.status };
    } catch (error) {
      requestMeta.error = error?.message || 'request_failed';
      state.lastSend = requestMeta;
      return { ok: false, correlationId, error: requestMeta.error };
    }
  }

  function diagnostics() {
    return {
      flags: {
        enabled,
        hasPmUrl: Boolean(baseUrl),
        hasIngestToken: Boolean(ingestToken),
        testEnabled,
        hasTestToken: Boolean(testToken),
        hooksInstalled: state.hooksInstalled,
      },
      lastSend: state.lastSend,
    };
  }

  function isTestRequestAllowed(token) {
    if (!testEnabled || !testToken) return false;
    return token === testToken;
  }

  function attachProcessHooks() {
    if (state.hooksInstalled) return;
    state.hooksInstalled = true;
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled rejection'));
      send('error', 'unhandledRejection', {
        source: 'process',
        error: error.message,
        stack: error.stack,
      });
    });
    process.on('uncaughtException', (error) => {
      const resolved = error instanceof Error ? error : new Error(String(error || 'Uncaught exception'));
      send('error', 'uncaughtException', {
        source: 'process',
        error: resolved.message,
        stack: resolved.stack,
      });
    });
  }

  return {
    send,
    info: (message, meta) => send('info', message, meta),
    warn: (message, meta) => send('warn', message, meta),
    error: (message, meta) => send('error', message, meta),
    diagnostics,
    isTestRequestAllowed,
    attachProcessHooks,
  };
}

function attachAxiosInterceptor(axiosInstance, pmLogger) {
  if (!axiosInstance || !axiosInstance.interceptors || !pmLogger) return false;
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error?.config || {};
      const response = error?.response;
      await pmLogger.error('axios_request_failed', {
        url: config.url,
        method: config.method,
        statusCode: response?.status,
        correlationId: response?.headers?.['x-correlation-id'] || config?.headers?.['x-correlation-id'],
      });
      return Promise.reject(error);
    },
  );
  return true;
}

function createPmFetch(fetchFn, pmLogger) {
  if (!fetchFn || !pmLogger) {
    throw new Error('createPmFetch requires fetch implementation and logger');
  }
  return async function pmFetch(url, options = {}) {
    const response = await fetchFn(url, options);
    if (response && !response.ok) {
      await pmLogger.error('fetch_request_failed', {
        url: String(url),
        method: options.method || 'GET',
        statusCode: response.status,
        correlationId: response.headers?.get?.('x-correlation-id') || null,
      });
    }
    return response;
  };
}

module.exports = {
  createPmLogger,
  attachAxiosInterceptor,
  createPmFetch,
};
