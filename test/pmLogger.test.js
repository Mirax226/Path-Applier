const test = require('node:test');
const assert = require('node:assert/strict');

const { createPmLogger } = require('../src/pmLogger');

test('pm logger sends to PM_URL /api/logs with PM_INGEST_TOKEN', async () => {
  const calls = [];
  const fetchStub = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200 };
  };

  const logger = createPmLogger({
    env: {
      PM_URL: 'https://pm.example.com',
      PM_INGEST_TOKEN: 'ingest-token',
      PM_TEST_ENABLED: 'true',
      PM_TEST_TOKEN: 'test-token',
    },
    fetch: fetchStub,
  });

  const result = await logger.info('hello', { secretToken: 'abc' });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://pm.example.com/api/logs');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ingest-token');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.meta.secretToken, '[MASKED]');
  assert.equal(typeof body.meta.correlationId, 'string');
});

test('pm logger is disabled without PM_INGEST_TOKEN', async () => {
  const logger = createPmLogger({
    env: {
      PM_URL: 'https://pm.example.com',
      PM_TEST_ENABLED: 'true',
      PM_TEST_TOKEN: 'test-token',
    },
    fetch: async () => {
      throw new Error('should not be called');
    },
  });

  const result = await logger.error('boom');
  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(logger.diagnostics().flags.enabled, false);
});
