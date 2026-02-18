const { Pool } = require('pg');
const { getConfigDbPool } = require('../../configDb');
const {
  ensureDbHubSchema,
  listProjectConnections,
  getProjectDbMode,
  recordConnectionHealth,
} = require('./hubStore');

const poolCache = new Map();
const WRITE_TIMEOUT_MS = 3000;

function getPool(dsn) {
  if (!poolCache.has(dsn)) {
    poolCache.set(dsn, new Pool({ connectionString: dsn, max: 2, idleTimeoutMillis: 15000 }));
  }
  return poolCache.get(dsn);
}

async function queueWriteRetry({ projectId, targetRole, sqlText, params, error, nextRunAt }) {
  const db = await getConfigDbPool();
  if (!db) return;
  await ensureDbHubSchema();
  await db.query(
    `INSERT INTO pm_db_write_queue(project_id,target_role,sql_text,params,status,last_error,attempts,updated_at)
     VALUES($1,$2,$3,$4,'queued',$5,0,now())`,
    [projectId, targetRole, sqlText, JSON.stringify(params || []), String(error?.message || 'unknown')],
  );
}

async function resolvePrimarySecondary(projectId) {
  const connections = await listProjectConnections(projectId, { includeDsn: true });
  const mode = await getProjectDbMode(projectId);
  const enabled = connections.filter((c) => c.enabled);
  const primary = mode.primaryConnectionId
    ? enabled.find((c) => c.id === mode.primaryConnectionId)
    : enabled.find((c) => c.role === 'primary');
  const secondary = mode.secondaryConnectionId
    ? enabled.find((c) => c.id === mode.secondaryConnectionId)
    : enabled.find((c) => c.role === 'secondary');
  return { primary: primary || null, secondary: secondary || null, mode };
}

async function pingConnection(connection) {
  if (!connection?.dsn) return { ok: false, error: 'missing_connection' };
  const started = Date.now();
  try {
    await getPool(connection.dsn).query('SELECT 1');
    const latencyMs = Date.now() - started;
    await recordConnectionHealth({ connectionId: connection.id, status: 'ok', latencyMs, error: null });
    return { ok: true, latencyMs };
  } catch (error) {
    await recordConnectionHealth({ connectionId: connection.id, status: 'down', latencyMs: null, error: error?.message || 'query_failed' });
    return { ok: false, error: error?.message || 'query_failed' };
  }
}

async function getPrimaryPool(projectId) {
  const { primary } = await resolvePrimarySecondary(projectId);
  if (!primary?.dsn) return null;
  return getPool(primary.dsn);
}

async function getSecondaryPool(projectId) {
  const { secondary } = await resolvePrimarySecondary(projectId);
  if (!secondary?.dsn) return null;
  return getPool(secondary.dsn);
}

async function readQuery(projectId, sqlText, params = []) {
  const { primary, secondary } = await resolvePrimarySecondary(projectId);
  if (!primary && !secondary) {
    return { ok: false, error: 'NO_CONNECTIONS' };
  }
  const attempts = [];
  if (primary) attempts.push({ role: 'primary', connection: primary });
  if (secondary) attempts.push({ role: 'secondary', connection: secondary });
  for (const attempt of attempts) {
    try {
      const result = await getPool(attempt.connection.dsn).query(sqlText, params);
      await recordConnectionHealth({ connectionId: attempt.connection.id, status: 'ok', latencyMs: null, error: null });
      return { ok: true, role: attempt.role, result };
    } catch (error) {
      await recordConnectionHealth({ connectionId: attempt.connection.id, status: 'down', latencyMs: null, error: error?.message || 'read_failed' });
    }
  }
  return { ok: false, error: 'READ_FAILED_BOTH' };
}

async function writeQuery(projectId, sqlText, params = []) {
  const { primary, secondary, mode } = await resolvePrimarySecondary(projectId);
  if (!primary && !secondary) {
    return { ok: false, error: 'NO_CONNECTIONS' };
  }
  const dualEnabled = mode.mode === 'dual' && mode.dualModeEnabled;
  const targets = dualEnabled ? [primary, secondary].filter(Boolean) : [primary || secondary].filter(Boolean);
  const outcomes = [];
  for (const target of targets) {
    const role = target.role || 'extra';
    try {
      await Promise.race([
        getPool(target.dsn).query(sqlText, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('WRITE_TIMEOUT')), WRITE_TIMEOUT_MS)),
      ]);
      outcomes.push({ role, ok: true });
      await recordConnectionHealth({ connectionId: target.id, status: 'ok', latencyMs: null, error: null });
    } catch (error) {
      outcomes.push({ role, ok: false, error: error?.message || 'write_failed' });
      await recordConnectionHealth({ connectionId: target.id, status: 'down', latencyMs: null, error: error?.message || 'write_failed' });
      const attempts = 1;
      const backoffMs = Math.min(30000, 1000 * (2 ** attempts));
      await queueWriteRetry({ projectId, targetRole: role, sqlText, params, error, nextRunAt: Date.now() + backoffMs });
    }
  }
  const someFailed = outcomes.some((o) => !o.ok);
  return {
    ok: !someFailed,
    mode: dualEnabled ? 'dual' : 'single',
    partialWrite: someFailed && outcomes.some((o) => o.ok),
    drift: someFailed ? 'POSSIBLE' : 'NONE',
    outcomes,
  };
}

async function getDbClient(projectId, opType = 'read') {
  const { primary, secondary, mode } = await resolvePrimarySecondary(projectId);
  if (opType === 'read') {
    if (primary) return { mode: mode.mode, role: 'primary', client: getPool(primary.dsn) };
    if (secondary) return { mode: mode.mode, role: 'secondary', client: getPool(secondary.dsn) };
    return null;
  }
  return {
    mode: mode.mode,
    primary: primary ? getPool(primary.dsn) : null,
    secondary: secondary ? getPool(secondary.dsn) : null,
    write: async (sqlText, params = []) => writeQuery(projectId, sqlText, params),
  };
}

module.exports = {
  getDbClient,
  getPrimaryPool,
  getSecondaryPool,
  readQuery,
  writeQuery,
  pingConnection,
};
