const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

const SUPABASE_CONNECTIONS_FILE = path.join(__dirname, 'supabaseConnections.json');
const SUPABASE_CONNECTIONS_KEY = 'supabaseConnections';

let pool = null;
let cachedConnections = null;
let hasLoadedConnections = false;

async function getPool() {
  if (pool) return pool;
  const dsn = process.env.PATH_APPLIER_CONFIG_DSN;
  if (!dsn) {
    throw new Error('PATH_APPLIER_CONFIG_DSN is not set');
  }
  pool = new Pool({ connectionString: dsn });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS path_config (
      id         SERIAL PRIMARY KEY,
      key        TEXT UNIQUE NOT NULL,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  return pool;
}

function normalizeConnections(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }
  return null;
}

async function loadConnectionsFromDb() {
  const db = await getPool();
  const res = await db.query(
    'SELECT data FROM path_config WHERE key = $1',
    [SUPABASE_CONNECTIONS_KEY],
  );
  if (res.rows.length === 0) return null;
  return normalizeConnections(res.rows[0].data);
}

async function loadConnectionsFromFile() {
  try {
    const content = await fs.readFile(SUPABASE_CONNECTIONS_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to load supabaseConnections.json', error);
    return [];
  }
}

async function loadSupabaseConnections() {
  if (hasLoadedConnections) {
    return cachedConnections ?? [];
  }

  const dbConnections = await loadConnectionsFromDb();
  if (dbConnections !== null) {
    cachedConnections = dbConnections;
    hasLoadedConnections = true;
    return cachedConnections;
  }

  const fileConnections = await loadConnectionsFromFile();
  cachedConnections = fileConnections;
  hasLoadedConnections = true;
  return cachedConnections;
}

async function findSupabaseConnection(id) {
  const connections = await loadSupabaseConnections();
  return connections.find((connection) => connection.id === id);
}

async function saveSupabaseConnections(connections) {
  const normalized = Array.isArray(connections) ? connections : [];
  const jsonText = JSON.stringify(normalized);
  const db = await getPool();
  await db.query(
    `
    INSERT INTO path_config(key, data)
    VALUES ($1, $2::jsonb)
    ON CONFLICT(key)
    DO UPDATE SET data = EXCLUDED.data,
                  updated_at = NOW()
  `,
    [SUPABASE_CONNECTIONS_KEY, jsonText],
  );
  cachedConnections = normalized;
  hasLoadedConnections = true;
}

module.exports = {
  loadSupabaseConnections,
  findSupabaseConnection,
  saveSupabaseConnections,
};
