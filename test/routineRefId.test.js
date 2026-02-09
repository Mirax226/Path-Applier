const test = require('node:test');
const assert = require('node:assert/strict');

const { matchBest } = require('../src/routineFixes');

test('refId prefix boosts matching behavior', async () => {
  const low = matchBest({ rawText: 'create failed' }, 0.8);
  assert.equal(low.accepted, null);

  const boosted = matchBest({ rawText: 'create failed', refId: 'CRON-ABC-1' }, 0.8);
  assert.equal(boosted.accepted, null);

  const direct = matchBest({ rawText: 'cron 500', refId: 'CRON-ABC-1' }, 0.8);
  assert.ok(direct.accepted);
  assert.equal(direct.accepted.ruleId, 'CRON_CREATE_500');
});
