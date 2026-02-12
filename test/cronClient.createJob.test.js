const assert = require('node:assert/strict');
const test = require('node:test');

function createResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body || {}),
  };
}

test('createJob sends wrapped job payload and falls back POST -> PUT on 405', async () => {
  process.env.CRON_API_TOKEN = 'test-token';
  const calls = [];
  const fetchMock = async (_url, options) => {
    calls.push(options);
    if (calls.length === 1) {
      return createResponse(405, { error: 'method not allowed' });
    }
    return createResponse(200, { jobId: 123 });
  };

  const fetchPath = require.resolve('node-fetch');
  delete require.cache[fetchPath];
  require.cache[fetchPath] = { exports: fetchMock };
  delete require.cache[require.resolve('../src/cronClient')];
  const client = require('../src/cronClient');

  const result = await client.createJob({ title: 'hello', url: 'https://example.com' });
  assert.equal(result.id, '123');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].body), { job: { title: 'hello', url: 'https://example.com' } });
});
