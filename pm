#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PM_TABLES = [
  'env_var_sets',
  'project_env_vars',
  'cron_job_links',
  'project_telegram_bots',
  'project_log_settings',
  'project_recent_logs',
];

function readArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function resolveSchemaName() {
  return process.env.PM_DB_SCHEMA || 'public';
}

function toTableName(schemaName, table) {
  if (!schemaName || schemaName === 'public') return table;
  return `${schemaName}.${table}`;
}

function parseDsnLabel(dsn) {
  if (!dsn) return 'missing';
  try {
    const url = new URL(dsn);
    const dbName = url.pathname ? url.pathname.replace(/^\//, '') : '-';
    return `${url.hostname || '-'}:${url.port || '5432'}/${dbName || '-'}`;
  } catch (error) {
    return 'invalid-dsn';
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '15',
      ...options.env,
    },
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runQuery(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '15',
      ...options.env,
    },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

function preflightDb(label, dsn) {
  if (!dsn) {
    console.error(`[pm db] ${label} DB missing. Set PM_DB_SOURCE_URL/PM_DB_TARGET_URL.`);
    process.exit(1);
  }
  console.log(`[pm db] preflight ${label}: ${parseDsnLabel(dsn)}`);
  runCommand('psql', ['-v', 'ON_ERROR_STOP=1', '-d', dsn, '-c', 'SELECT 1']);
}

function exportDb({ source, outDir, schemaOnly }) {
  const schemaName = resolveSchemaName();
  const tables = PM_TABLES.map((table) => toTableName(schemaName, table));
  fs.mkdirSync(outDir, { recursive: true });
  const schemaPath = path.join(outDir, 'schema.sql');
  const dataPath = path.join(outDir, 'data.sql');
  const postDataPath = path.join(outDir, 'post-data.sql');

  console.log(`[pm db] exporting schema to ${schemaPath}`);
  runCommand('pg_dump', [
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    '--format=p',
    `--file=${schemaPath}`,
    ...tables.flatMap((table) => ['--table', table]),
    '--dbname',
    source,
  ]);

  if (schemaOnly) {
    console.log('[pm db] schema-only export requested; skipping data export.');
    return;
  }

  console.log(`[pm db] exporting data to ${dataPath}`);
  runCommand('pg_dump', [
    '--data-only',
    '--no-owner',
    '--no-privileges',
    '--format=p',
    `--file=${dataPath}`,
    ...tables.flatMap((table) => ['--table', table]),
    '--dbname',
    source,
  ]);

  console.log(`[pm db] exporting indexes/constraints to ${postDataPath}`);
  runCommand('pg_dump', [
    '--section=post-data',
    '--no-owner',
    '--no-privileges',
    '--format=p',
    `--file=${postDataPath}`,
    ...tables.flatMap((table) => ['--table', table]),
    '--dbname',
    source,
  ]);
}

function importDb({ target, outDir }) {
  const schemaPath = path.join(outDir, 'schema.sql');
  const dataPath = path.join(outDir, 'data.sql');
  const postDataPath = path.join(outDir, 'post-data.sql');
  const schemaName = resolveSchemaName();

  if (schemaName && schemaName !== 'public') {
    console.log(`[pm db] ensuring schema ${schemaName} exists on target`);
    runCommand('psql', [
      '-v',
      'ON_ERROR_STOP=1',
      '-d',
      target,
      '-c',
      `CREATE SCHEMA IF NOT EXISTS ${schemaName};`,
    ]);
  }

  console.log(`[pm db] importing schema from ${schemaPath}`);
  runCommand('psql', ['-v', 'ON_ERROR_STOP=1', '-d', target, '-f', schemaPath]);

  console.log(`[pm db] importing data from ${dataPath}`);
  runCommand('psql', ['-v', 'ON_ERROR_STOP=1', '-d', target, '-f', dataPath]);

  if (fs.existsSync(postDataPath)) {
    console.log(`[pm db] applying indexes/constraints from ${postDataPath}`);
    runCommand('psql', ['-v', 'ON_ERROR_STOP=1', '-d', target, '-f', postDataPath]);
  }
}

function compareCounts({ source, target }) {
  const schemaName = resolveSchemaName();
  console.log('[pm db] validating row counts');
  PM_TABLES.forEach((table) => {
    const qualified = toTableName(schemaName, table);
    const sourceCount = runQuery('psql', ['-At', '-d', source, '-c', `SELECT COUNT(*) FROM ${qualified};`]);
    const targetCount = runQuery('psql', ['-At', '-d', target, '-c', `SELECT COUNT(*) FROM ${qualified};`]);
    const ok = sourceCount === targetCount;
    const label = ok ? '✅' : '❌';
    console.log(`${label} ${qualified}: source=${sourceCount} target=${targetCount}`);
    if (!ok) {
      process.exitCode = 1;
    }
  });
}

function printUsage() {
  console.log(`
Usage:
  pm db:export [--source <dsn>] [--out-dir <dir>] [--schema-only]
  pm db:import [--target <dsn>] [--out-dir <dir>]

Environment:
  PM_DB_SOURCE_URL, PM_DB_TARGET_URL, DATABASE_URL_PM, PATH_APPLIER_CONFIG_DSN, DATABASE_URL
  PM_DB_SCHEMA (default: public)
  PGCONNECT_TIMEOUT (default: 15)
`);
}

const args = process.argv.slice(2);
const command = args[0];
const outDir = readArgValue(args, '--out-dir') || path.join(process.cwd(), 'pm-db-export');
const source = readArgValue(args, '--source') || process.env.PM_DB_SOURCE_URL || process.env.DATABASE_URL_PM || process.env.PATH_APPLIER_CONFIG_DSN || process.env.DATABASE_URL;
const target = readArgValue(args, '--target') || process.env.PM_DB_TARGET_URL || process.env.DATABASE_URL_PM || process.env.DATABASE_URL;
const schemaOnly = hasFlag(args, '--schema-only');

if (!command) {
  printUsage();
  process.exit(1);
}

if (command === 'db:export') {
  preflightDb('source', source);
  exportDb({ source, outDir, schemaOnly });
  process.exit(0);
}

if (command === 'db:import') {
  preflightDb('target', target);
  importDb({ target, outDir });
  if (source) {
    compareCounts({ source, target });
  } else {
    console.log('[pm db] source not provided; skipping count comparison.');
  }
  process.exit(0);
}

printUsage();
process.exit(1);
