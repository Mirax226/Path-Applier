module.exports = {
  id: 'INVALID_DSN',
  title: 'Invalid Postgres DSN (Invalid URL) due to unescaped chars',
  triggers: ['invalid url', 'invalid postgres dsn', 'dsn', 'postgres url'],
  internalOnlyAutoButton: true,
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('invalid url') && !text.includes('postgres') && !text.includes('dsn')) return null;
    return { confidence: 0.9, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Postgres DSN contains unescaped credentials or reserved URL chars.',
        'Connection parsing fails before any network attempt.',
      ],
      steps: [
        'Encode DSN userinfo safely before using URL parser.',
        'Apply one-time auto-fix marker to avoid repeated rewrites.',
        'Fail fast with masked error; do not forward raw DSN to Telegram.',
      ],
      task:
        'Implement DSN sanitizer that percent-encodes username/password in postgres URL userinfo when parsing fails with Invalid URL. Apply once-only auto-fix guard, keep secret masking, and avoid forwarding DSN details to Telegram. If still invalid, fail fast with a safe actionable message.',
    };
  },
};
