const test = require('node:test');
const assert = require('node:assert/strict');

const { __test } = require('../bot');

test('Fix (routine) button attached only for high confidence non-internal rule', async () => {
  const button = __test.buildRoutineFixButton('Failed to create cron job. Cron API PUT /jobs failed (500)');
  assert.ok(button);
  assert.equal(button.text, '🛠 Fix (routine)');
});

test('Fix (routine) button suppressed for internal-only DSN rule', async () => {
  const button = __test.buildRoutineFixButton('Invalid URL postgres dsn parse error', 'INVALID_URL');
  assert.equal(button, null);
});
