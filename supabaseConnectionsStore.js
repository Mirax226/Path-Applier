// configStore.js
const { Pool } = require("pg");

let pool = null;

async function getPool() {
  if (pool) return pool;
  const dsn = process.env.PATH_APPLIER_CONFIG_DSN;
  if (!dsn) {
    throw new Error("PATH_APPLIER_CONFIG_DSN is not set");
  }
  pool = new Pool({ connectionString: dsn });

  // ایجاد جدول در صورت نبودن
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

async function loadProjects() {
  const db = await getPool();
  const res = await db.query(
    "SELECT data FROM path_config WHERE key = $1",
    ["projects"]
  );
  if (res.rows.length === 0) return [];
  // اینجا data خودش یک JSONB است، نیازی به JSON.parse نیست
  const value = res.rows[0].data;
  // اگر قبلاً اشتباهی رشته ذخیره شده باشد، سعی می‌کنیم parse کنیم
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

async function saveProjects(projects) {
  const db = await getPool();
  const jsonText = JSON.stringify(projects ?? []);
  await db.query(
    `
    INSERT INTO path_config(key, data)
    VALUES ($1, $2::jsonb)
    ON CONFLICT(key)
    DO UPDATE SET data = EXCLUDED.data,
                  updated_at = NOW()
  `,
    ["projects", jsonText]
  );
}

async function loadGlobalSettings() {
  const db = await getPool();
  const res = await db.query(
    "SELECT data FROM path_config WHERE key = $1",
    ["globalSettings"]
  );
  if (res.rows.length === 0) return null;
  const value = res.rows[0].data;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

async function saveGlobalSettings(settings) {
  const db = await getPool();
  const jsonText = JSON.stringify(settings ?? {});
  await db.query(
    `
    INSERT INTO path_config(key, data)
    VALUES ($1, $2::jsonb)
    ON CONFLICT(key)
    DO UPDATE SET data = EXCLUDED.data,
                  updated_at = NOW()
  `,
    ["globalSettings", jsonText]
  );
}

module.exports = {
  loadProjects,
  saveProjects,
  loadGlobalSettings,
  saveGlobalSettings,
};