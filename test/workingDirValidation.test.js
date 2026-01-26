const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');

const { validateWorkingDir } = require('../bot');
const { getDefaultWorkingDir } = require('../gitUtils');

test('validateWorkingDir rejects non-absolute paths', async () => {
  const result = await validateWorkingDir({
    repoSlug: 'test-owner/test-repo',
    workingDir: 'relative/path',
    projectType: 'node-api',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_ABSOLUTE');
});

test('validateWorkingDir rejects paths outside checkout dir', async () => {
  const repoSlug = 'test-owner/test-repo';
  const outsideDir = path.join('/tmp', 'outside-workdir-test');
  await fs.mkdir(outsideDir, { recursive: true });

  const result = await validateWorkingDir({
    repoSlug,
    workingDir: outsideDir,
    projectType: 'node-api',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'OUTSIDE_REPO');
});

test('validateWorkingDir detects missing package.json', async () => {
  const repoSlug = 'test-owner/test-repo';
  const checkoutDir = getDefaultWorkingDir(repoSlug);
  await fs.rm(checkoutDir, { recursive: true, force: true });
  await fs.mkdir(checkoutDir, { recursive: true });

  const result = await validateWorkingDir({
    repoSlug,
    workingDir: checkoutDir,
    projectType: 'node-api',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'PACKAGE_JSON_MISSING');
});
