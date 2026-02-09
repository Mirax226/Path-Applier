module.exports = {
  id: 'NON_MENU_DELETE_BUTTON',
  title: 'Non-menu messages missing 🗑 Delete button',
  triggers: ['Ping Render: HTTP 200', 'no delete', 'missing delete button'],
  match(ctx) {
    const text = ctx.normalizedText;
    if (!text.includes('ping render: http 200') && !text.includes('no delete') && !text.includes('missing delete')) {
      return null;
    }
    return {
      confidence: text.includes('ping render: http 200') && text.includes('delete') ? 0.95 : 0.86,
      fields: {},
    };
  },
  render() {
    return {
      diagnosis: [
        'Routine status messages are emitted without a dismiss button.',
        'Users cannot clean up noisy diagnostic messages quickly.',
      ],
      steps: [
        'Add one helper that always appends a secure 🗑 Delete callback.',
        'Refactor all non-menu sendMessage/reply paths to use that helper.',
        'Add a test that verifies owner-only/admin deletion behavior.',
      ],
      task:
        'Implement a shared sendEphemeral/sendDismissible helper for PM bot messages. Ensure every non-menu informational message includes a 🗑 Delete inline button. Refactor existing direct sendMessage/reply usages to call the helper. Keep callback payload secret-free and authorize delete for owner in private chats and owner/admin in groups. Add unit tests for button presence and authorization.',
    };
  },
};
