const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');

const { classifyDiagnosticsError, validateWorkingDir } = require('../bot');
const { getDefaultWorkingDir } = require('../gitUtils');

test('classifyDiagnosticsError maps package.json ENOENT to working dir invalid', async () => {
  const repoSlug = 'test-owner/test-repo';
  const checkoutDir = getDefaultWorkingDir(repoSlug);
  await fs.rm(checkoutDir, { recursive: true, force: true });
  await fs.mkdir(checkoutDir, { recursive: true });
  await fs.writeFile(`${checkoutDir}/package.json`, '{"name":"test"}');

  const workingDir = `${checkoutDir}/wrong`; 
  const project = { repoSlug, projectType: 'node-api' };
  const validation = await validateWorkingDir({ ...project, workingDir });
  const result = {
    exitCode: 1,
    stderr: `npm ERR! code ENOENT\nnpm ERR! syscall open\nnpm ERR! path ${workingDir}/package.json\nnpm ERR! errno -2\nnpm ERR! enoent ENOENT: no such file or directory, open '${workingDir}/package.json'`,
    stdout: '',
  };

  const classified = classifyDiagnosticsError({ result, project, workingDir, validation });

  assert.equal(classified.reason, 'WORKING_DIR_INVALID');
  assert.ok(classified.message.includes('package.json'));
});
