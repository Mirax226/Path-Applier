function buildRoutineTemplate({ diagnosisLines, steps, taskText }) {
  const diagnosis = Array.isArray(diagnosisLines) ? diagnosisLines.slice(0, 3) : [];
  const todoSteps = Array.isArray(steps) ? steps.slice(0, 3) : [];
  const body = [
    '[Diagnosis]',
    ...diagnosis.map((line) => `- ${line}`),
    '',
    '[What you do now]',
    ...todoSteps.map((line) => `- [ ] ${line}`),
    '',
    '[Codex Task (copy)]',
    '```text',
    String(taskText || '').trim(),
    '```',
  ];
  return body.join('\n');
}

module.exports = { buildRoutineTemplate };
