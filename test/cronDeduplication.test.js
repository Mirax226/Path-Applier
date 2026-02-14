const assert = require('node:assert/strict');
const test = require('node:test');

const { upsertCronJobLink, listCronJobLinks } = require('../cronJobLinksStore');
const { __test } = require('../bot');

test('keepalive upsert by jobKey keeps single record', async () => {
  const projectId = `proj-${Date.now()}`;
  const jobKey = `${projectId}:keepalive`;

  await upsertCronJobLink('job-1', projectId, 'keepalive', {
    providerJobId: 'job-1',
    jobKey,
    enabled: true,
    scheduleNormalized: 'every 5 minutes',
    targetNormalized: `https://example.com/keep-alive/${projectId}`,
  });
  await upsertCronJobLink('job-2', projectId, 'keepalive', {
    providerJobId: 'job-2',
    jobKey,
    enabled: true,
    scheduleNormalized: 'every 5 minutes',
    targetNormalized: `https://example.com/keep-alive/${projectId}`,
  });

  const links = await listCronJobLinks();
  const sameKey = links.filter((item) => item.jobKey === jobKey);
  assert.equal(sameKey.length, 1);
  assert.equal(String(sameKey[0].providerJobId), 'job-2');
});

test('UI dedupe keeps one keepalive per jobKey', () => {
  const projectId = 'dailymanager';
  const jobs = [
    {
      id: '101',
      name: `PM:${projectId}:keepalive path-applier:${projectId}:keep-alive`,
      enabled: true,
      url: `https://example.com/keep-alive/${projectId}`,
      minutes: [0, 5, 10],
      hours: -1,
      expression: null,
    },
    {
      id: '102',
      name: `PM:${projectId}:keepalive path-applier:${projectId}:keep-alive`,
      enabled: false,
      url: `https://example.com/keep-alive/${projectId}`,
      minutes: [0, 5, 10],
      hours: -1,
      expression: null,
    },
  ];
  const linksMap = new Map([
    ['101', { cronJobId: '101', projectId, jobKey: `${projectId}:keepalive`, enabled: true, lastUpdatedAt: '2025-01-01T00:00:00.000Z' }],
    ['102', { cronJobId: '102', projectId, jobKey: `${projectId}:keepalive`, enabled: false, lastUpdatedAt: '2024-01-01T00:00:00.000Z' }],
  ]);
  const projects = [{ id: projectId, name: 'DailyManager' }];

  const deduped = __test.dedupeCronJobsByJobKey(jobs, linksMap, projects);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, '101');
  assert.equal(deduped[0].duplicatesDetected, true);
});
