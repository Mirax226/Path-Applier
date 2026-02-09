const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || 'TEST';
process.env.ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '1';
process.env.PM_TEST_ENABLED = 'true';
process.env.PM_TEST_TOKEN = 'pm-test-token';

const { __test } = require('../bot');

test('pm diagnostics returns boolean feature flags', () => {
  const payload = __test.getPmDiagnosticsForTests();
  assert.equal(typeof payload.flags.enabled, 'boolean');
  assert.equal(typeof payload.flags.hasPmUrl, 'boolean');
  assert.equal(typeof payload.flags.hasIngestToken, 'boolean');
  assert.equal(typeof payload.flags.testEnabled, 'boolean');
  assert.equal(typeof payload.flags.hasTestToken, 'boolean');
  assert.equal(typeof payload.flags.hooksInstalled, 'boolean');
});

test('pm test token validation helper', () => {
  assert.equal(__test.isPmTestAllowedForTests('pm-test-token'), true);
  assert.equal(__test.isPmTestAllowedForTests('wrong-token'), false);
});

test('bearer token parser extracts token', () => {
  const token = __test.getBearerToken({ headers: { authorization: 'Bearer abc123' } });
  assert.equal(token, 'abc123');
});
