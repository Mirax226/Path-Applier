const test = require('node:test');
const assert = require('node:assert/strict');
const { maskEnvValue, evaluateEnvValueStatus } = require('../bot');

test('maskEnvValue preserves length with first/last two characters', () => {
  assert.equal(maskEnvValue('abcdef'), 'ab**ef');
  assert.equal(maskEnvValue('abcd'), '****');
  assert.equal(maskEnvValue('ab'), '****');
  assert.equal(maskEnvValue('secretvalue'), 'se*******ue');
});

test('evaluateEnvValueStatus detects missing/empty/invalid/set', () => {
  assert.equal(evaluateEnvValueStatus(undefined).status, 'MISSING');
  assert.equal(evaluateEnvValueStatus(null).status, 'MISSING');
  assert.equal(evaluateEnvValueStatus('  ').status, 'EMPTY');
  assert.equal(evaluateEnvValueStatus('-').status, 'INVALID');
  assert.equal(evaluateEnvValueStatus('undefined').status, 'INVALID');
  assert.equal(evaluateEnvValueStatus('value').status, 'SET');
});
