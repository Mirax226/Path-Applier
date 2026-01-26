const http = require('http');
const { startBot } = require('../bot.js');

console.error('[boot] starting', {
  node: process.version,
  pid: process.pid,
  time: new Date().toISOString(),
  env: {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    BOT_TOKEN: Boolean(process.env.BOT_TOKEN),
    ENV_VAULT_MASTER_KEY: Boolean(process.env.ENV_VAULT_MASTER_KEY),
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
  },
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] uncaughtException', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[FATAL] unhandledRejection', error);
});

process.on('exit', (code) => {
  console.error('[boot] process exit', code);
});

const port = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(port, () => {
  console.error('[boot] http listening on :%s', port);
});

async function main() {
  await startBot();
}

main().catch((error) => {
  console.error('[FATAL] main failed', error?.stack || error);
  setInterval(() => {}, 60_000);
});
