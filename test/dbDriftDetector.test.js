const assert = require('node:assert/strict');
const test = require('node:test');

const { calculateDbDrift } = require('../src/driftDetector');

test('calculateDbDrift detects row-count and updated_at mismatches', () => {
  const result = calculateDbDrift(
    [{ table_schema: 'public', table_name: 'users', row_count: 10, updated_at_max: '2025-01-01T00:00:00Z' }],
    [{ table_schema: 'public', table_name: 'users', row_count: 9, updated_at_max: '2025-01-01T00:00:00Z' }],
  );
  assert.equal(result.hasDrift, true);
  assert.equal(result.diffs.length, 1);
  assert.equal(result.diffs[0].status, 'mismatch');
});

test('calculateDbDrift reports clean when stats match', () => {
  const result = calculateDbDrift(
    [{ schema: 'public', table: 'users', rowCount: 10, updatedAtMax: '2025-01-01T00:00:00Z' }],
    [{ schema: 'public', table: 'users', rowCount: 10, updatedAtMax: '2025-01-01T00:00:00Z' }],
  );
  assert.equal(result.hasDrift, false);
  assert.equal(result.diffs.length, 0);
});
