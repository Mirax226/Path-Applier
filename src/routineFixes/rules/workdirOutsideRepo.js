module.exports = {
  id: 'WORKDIR_OUTSIDE_REPO',
  title: 'Working directory invalid (outside repo) false positive',
  triggers: ['working directory is invalid (outside repo)', 'outside repo', 'working dir invalid'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('outside repo') && !text.includes('working directory is invalid')) return null;
    return { confidence: 0.94, fields: {} };
  },
  render() {
    return {
      diagnosis: [
        'Path validation rejects valid repository-relative locations.',
        'Normalization/realpath rules are too strict or inconsistent.',
      ],
      steps: [
        'Normalize candidate paths and accept "." as repo root.',
        'Use realpath checks to prevent traversal outside repo only.',
        'Add tests for valid relative paths and blocked traversal.',
      ],
      task:
        'Fix workingDir validation false positives: accept "." and normalized repo-relative paths, resolve realpath safely, and reject only traversal that escapes repository root. Preserve deterministic checks and update tests for valid/invalid cases.',
    };
  },
};
