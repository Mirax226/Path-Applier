module.exports = {
  id: 'SCHEMA_RUNNER_MINI_APP',
  title: 'Schema runner should move to Mini App',
  triggers: ['schema runner should move to mini app', 'schema runner', 'mini app'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('schema runner')) return null;
    return { confidence: 0.88, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Schema runner action is exposed in bot settings where UX and safety are limited.',
        'It should live in Mini App flow only.',
      ],
      steps: [
        'Remove schema runner entry from bot settings menus.',
        'Add schema runner UI/action to Mini App page.',
        'Keep bot side as Open WebApp button only.',
      ],
      task:
        'Move schema runner from Telegram settings UI to Mini App. Remove direct bot setting actions for schema runner, expose it inside the Mini App page, and keep Telegram entry as “Open WebApp” only. Preserve permissions and audit logging.',
    };
  },
};
