const test = require('node:test');
const assert = require('node:assert/strict');

const { matchBest, listCatalog } = require('../src/routineFixes');

test('quick detect matches each routine rule via keyword', async () => {
  const samples = [
    ['NON_MENU_DELETE_BUTTON', 'ping render: http 200 no delete button'],
    ['GENERIC_HANDLER', '⚠️ something went wrong'],
    ['WORKDIR_OUTSIDE_REPO', 'working directory is invalid outside repo'],
    ['CRON_CREATE_500', 'failed to create cron job'],
    ['INVALID_DSN', 'invalid url postgres dsn'],
    ['ENVSCAN_STUCK', 'env scan stuck waiting testing'],
    ['REPO_INSPECTION_MISSING_FEATURES', 'repo inspection missing diagnostics'],
    ['SCHEMA_RUNNER_MINI_APP', 'schema runner should move to mini app'],
    ['OOM_LOOP', 'Reached heap limit Allocation failed - JavaScript heap out of memory'],
  ];

  for (const [ruleId, rawText] of samples) {
    const result = matchBest({ rawText }, 0.8);
    assert.ok(result.accepted, `expected match for ${ruleId}`);
    assert.equal(result.accepted.ruleId, ruleId);
  }
});

test('template has strict sections', async () => {
  const out = matchBest({ rawText: 'cron 500 failed to create cron job' }, 0.8).accepted;
  assert.ok(out.templateText.includes('[Diagnosis]'));
  assert.ok(out.templateText.includes('[What you do now]'));
  assert.ok(out.templateText.includes('[Codex Task (copy)]'));
  assert.match(out.templateText, /```text[\s\S]*```/);
});

test('catalog includes routine rules', async () => {
  const ids = new Set(listCatalog().map((x) => x.id));
  assert.ok(ids.has('CRON_CREATE_500'));
  assert.ok(ids.has('INVALID_DSN'));
});
