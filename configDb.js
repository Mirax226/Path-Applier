const { Pool } = require('pg');
const { classifyDbError, sanitizeDbErrorMessage } = require('./configDbErrors');

let pool = null;
let sslWarningEmitted = false;
const DB_POOL_MAX = 3;
const DB_IDLE_TIMEOUT_MS = 30_000;
const DB_CONNECTION_TIMEOUT_MS = 15_000;
const DB_STATEMENT_TIMEOUT_MS = 5000;
const DB_OPERATION_TIMEOUT_MS = 5000;
const ALLOW_INSECURE_TLS_FOR_TESTS = process.env.ALLOW_INSECURE_TLS_FOR_TESTS === 'true';

function getConfigDbEnvSource() {
  if (process.env.DATABASE_URL_PM) {
    return { envVar: 'DATABASE_URL_PM', dsn: process.env.DATABASE_URL_PM };
  }
  if (process.env.PATH_APPLIER_CONFIG_DSN) {
    return { envVar: 'PATH_APPLIER_CONFIG_DSN', dsn: process.env.PATH_APPLIER_CONFIG_DSN };
  }
  return { envVar: null, dsn: null };
}

function maskDsn(dsn) {
  if (!dsn) return null;
  const text = String(dsn);
  try {
    const parsed = new URL(text);
    const username = parsed.username || '';
    const password = parsed.password || '';
    const maskedPassword = password ? `***${password.slice(-4)}` : '';
    const userInfo = username
      ? `${username}${password ? `:${maskedPassword}` : ''}@`
      : '';
    return `${parsed.protocol}//${userInfo}${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch (_error) {
    return text.replace(/(postgres(?:ql)?:\/\/[^:\s@]+:)([^@\s]+)(@)/i, (_m, p1, p2, p3) => {
      const suffix = String(p2).slice(-4);
      return `${p1}***${suffix}${p3}`;
    });
  }
}

function tryFixPostgresDsn(dsn) {
  const dsnText = String(dsn || '');
  if (!dsnText) {
    return { dsn: dsnText, fixed: false };
  }

  try {
    new URL(dsnText);
    return { dsn: dsnText, fixed: false };
  } catch (error) {
    const schemeMatch = dsnText.match(/^(postgres(?:ql)?:\/\/)(.+)$/i);
    if (!schemeMatch) {
      return { dsn: dsnText, fixed: false, error };
    }

    const scheme = schemeMatch[1];
    const remainder = schemeMatch[2];
    const atIndex = remainder.lastIndexOf('@');
    if (atIndex <= 0 || atIndex >= remainder.length - 1) {
      return { dsn: dsnText, fixed: false, error };
    }

    const userInfo = remainder.slice(0, atIndex);
    const hostPart = remainder.slice(atIndex + 1);
    const separatorIndex = userInfo.indexOf(':');

    let rebuilt;
    if (separatorIndex >= 0) {
      const user = userInfo.slice(0, separatorIndex);
      const password = userInfo.slice(separatorIndex + 1);
      const encodedUser = encodeURIComponent(user);
      const encodedPassword = encodeURIComponent(password);
      rebuilt = `${scheme}${encodedUser}:${encodedPassword}@${hostPart}`;
    } else {
      const encodedUser = encodeURIComponent(userInfo);
      rebuilt = `${scheme}${encodedUser}@${hostPart}`;
    }

    try {
      new URL(rebuilt);
      return { dsn: rebuilt, fixed: true };
    } catch (validationError) {
      return { dsn: dsnText, fixed: false, error: validationError };
    }
  }
}

async function forwardConfigDbWarning(message, context) {
  try {
    const { forwardSelfLog } = require('./logger');
    if (typeof forwardSelfLog === 'function') {
      await forwardSelfLog('warn', message, { context });
      return;
    }
  } catch (_error) {
    // noop fallback to console only
  }
}

async function getConfigDbPool() {
  const { envVar, dsn: rawDsn } = getConfigDbEnvSource();
  if (!rawDsn) {
    console.warn('[configDb] DATABASE_URL_PM/PATH_APPLIER_CONFIG_DSN not set; using in-memory config only.');
    return null;
  }

  const fixResult = tryFixPostgresDsn(rawDsn);
  const dsn = fixResult.dsn;
  if (fixResult.fixed) {
    const warningMessage = `[configDb] Auto-fixed malformed Postgres DSN from ${envVar} (detected unescaped special characters in username/password). Please update ENV with encoded credentials.`;
    const context = {
      envVar,
      detected: 'Invalid URL caused by unescaped special characters in username/password',
      originalMaskedDsn: maskDsn(rawDsn),
      correctedMaskedDsn: maskDsn(dsn),
      fixHint: 'Set encoded DSN in ENV (encode username/password only).',
    };
    console.warn(warningMessage, context);
    await forwardConfigDbWarning(warningMessage, context);
  }

  if (!pool) {
    if (!sslWarningEmitted) {
      const sslMode = `${dsn} ${process.env.DATABASE_URL || ''}`.toLowerCase();
      if (sslMode.includes('sslmode=require') && !sslMode.includes('uselibpqcompat=true')) {
        console.warn(
          '[configDb] SSL warning: add uselibpqcompat=true or use direct 5432 Supabase host to avoid SSL chain errors.',
        );
        sslWarningEmitted = true;
      }
    }
    const sslMode = `${dsn} ${process.env.DATABASE_URL || ''}`.toLowerCase();
    const sslRequired = sslMode.includes('sslmode=require') || sslMode.includes('ssl=true');
    const ssl = sslRequired
      ? { rejectUnauthorized: !ALLOW_INSECURE_TLS_FOR_TESTS }
      : undefined;
    pool = new Pool({
      connectionString: dsn,
      max: DB_POOL_MAX,
      idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
      options: `-c statement_timeout=${DB_STATEMENT_TIMEOUT_MS}`,
      keepAlive: true,
      ssl,
    });
  }

  return pool;
}

async function withDbTimeout(promise, context) {
  if (!promise || typeof promise.then !== 'function') return promise;
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('DB_TIMEOUT');
      error.code = 'DB_TIMEOUT';
      error.context = context;
      reject(error);
    }, DB_OPERATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function testConfigDbConnection() {
  const db = await getConfigDbPool();
  if (!db) {
    return { ok: false, category: 'UNKNOWN_DB_ERROR', message: 'not configured', configured: false };
  }
  try {
    await withDbTimeout(db.query('SELECT 1'), 'config_db_test');
    return { ok: true, configured: true };
  } catch (error) {
    const category = classifyDbError(error);
    const message = sanitizeDbErrorMessage(error?.message) || 'connection failed';
    return { ok: false, category, message, configured: true };
  }
}

module.exports = {
  getConfigDbPool,
  testConfigDbConnection,
  maskDsn,
  tryFixPostgresDsn,
};
