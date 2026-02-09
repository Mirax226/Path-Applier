module.exports = {
  id: 'GENERIC_HANDLER',
  title: 'Generic “Something went wrong” handler',
  triggers: ['something went wrong'],
  match(ctx) {
    if (!ctx.normalizedText.includes('something went wrong')) return null;
    return { confidence: 0.93, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Failure path is generic and hides actionable diagnostics.',
        'Operators need traceable refId and safe debug details.',
      ],
      steps: [
        'Generate a refId for each failure path and log it with category.',
        'Show short user-safe details with Retry and Back actions.',
        'Keep internal stack/metadata in event_log only.',
      ],
      task:
        'Replace generic “⚠️ Something went wrong” handling with deterministic error envelopes: include refId, category, and short safe details in user-visible text; add Retry/Back actions; log full debug context to internal event_log only. Ensure no secrets are exposed and add tests covering fallback rendering.',
    };
  },
};
