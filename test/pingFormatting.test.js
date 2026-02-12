const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');

test('ping test output joins lines with real newline escape', () => {
  const source = fs.readFileSync(require.resolve('../bot'), 'utf8');
  assert.match(source, /renderOrEdit\(ctx, lines\.join\('\\n'\), \{ reply_markup: inline \}\);/);
});
