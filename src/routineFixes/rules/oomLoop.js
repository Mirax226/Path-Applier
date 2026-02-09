module.exports = {
  id: 'OOM_LOOP',
  title: 'Node heap out-of-memory loop',
  triggers: ['heap out of memory', 'reached heap limit'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('heap out of memory') && !text.includes('reached heap limit')) return null;
    return { confidence: 0.9, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Process repeatedly crashes due to V8 heap exhaustion.',
      ],
      steps: [
        'Capture heap usage and offending workflow boundaries.',
        'Add bounded batching/streaming to high-memory operations.',
        'Add restart guard and alert with refId for recurrence.',
      ],
      task:
        'Fix OOM loop by adding memory-safe batching/streaming in heavy paths, instrument heap usage around failing operations, and guard with deterministic restart throttling + alerting. Include a regression test or fixture that reproduces prior unbounded memory behavior.',
    };
  },
};
