module.exports = {
  id: 'ENVSCAN_STUCK',
  title: 'Env scan stuck on waiting',
  triggers: ['env scan stuck', 'waiting testing', 'waiting'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('env scan') && !text.includes('waiting testing')) return null;
    return { confidence: 0.9, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Wizard/scan state is not advanced after check completion.',
        'User remains in indefinite waiting state.',
      ],
      steps: [
        'Advance state automatically when scan result is available.',
        'Attach report payload to completion message.',
        'Add timeout guard to prevent stuck waiting state.',
      ],
      task:
        'Fix env scan waiting flow: once scan finishes (success/fail), auto-advance wizard state, attach summary report, and clear waiting flag. Add timeout fallback to break stale waiting states deterministically.',
    };
  },
};
