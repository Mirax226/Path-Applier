module.exports = {
  id: 'REPO_INSPECTION_MISSING_FEATURES',
  title: 'Repo inspection missing diagnostics/test-log/log forwarder hooks',
  triggers: ['/pm/diagnostics', '/pm/test-log', 'repo inspection missing'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('repo inspection missing') && !(text.includes('/pm/diagnostics') && text.includes('/pm/test-log'))) return null;
    return { confidence: 0.91, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Client repo lacks expected PM diagnostics and log-forwarder integration points.',
      ],
      steps: [
        'Add /pm/diagnostics and /pm/test-log endpoints.',
        'Register crash hooks for unhandled rejection/exception forwarding.',
        'Wire PM_URL + PM_TOKEN usage in logger sender.',
      ],
      task:
        'Implement missing PM integration hooks in client repo: add /pm/diagnostics and /pm/test-log endpoints, register uncaughtException/unhandledRejection forwarding, and configure logger transport to use PM_URL + PM_TOKEN. Include a basic self-test proving logs and diagnostics are reachable.',
    };
  },
};
