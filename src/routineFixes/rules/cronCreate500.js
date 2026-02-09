module.exports = {
  id: 'CRON_CREATE_500',
  title: 'Cron create job 500 (method mismatch / endpoint)',
  triggers: ['cron api put /jobs failed (500)', 'failed to create cron job', 'cron 500'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('failed to create cron job') && !text.includes('cron api put /jobs failed (500)') && !text.includes('cron 500')) return null;
    return { confidence: 0.96, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Cron job creation is calling the wrong HTTP method/endpoint.',
        'The API rejects create requests and returns 500.',
      ],
      steps: [
        'Use POST /jobs for create and keep PUT only for updates.',
        'Show response/body snippet in PM diagnostics for failures.',
        'Add ping test + input validation for schedule and target URL.',
      ],
      task:
        'Patch cron integration so create flow uses POST /jobs (not PUT). Keep update flow on PUT/PATCH as currently required. On create failure, include status + short body snippet in diagnostics. Add deterministic validation for schedule and target before request and add a ping test to verify Cron API reachability.',
    };
  },
};
