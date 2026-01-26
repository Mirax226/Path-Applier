const assert = require('node:assert/strict');
const test = require('node:test');

const { respond } = require('../bot');

test('respond edits message for callback queries', async () => {
  let edited = false;
  let replied = false;
  const ctx = {
    callbackQuery: {
      message: {
        message_id: 123,
        chat: { id: 456 },
      },
    },
    editMessageText: async (text) => {
      edited = text === 'hello';
    },
    reply: async () => {
      replied = true;
    },
  };

  await respond(ctx, 'hello', {});

  assert.equal(edited, true);
  assert.equal(replied, false);
});

test('respond replies in message context', async () => {
  let replied = false;
  const ctx = {
    reply: async (text) => {
      replied = text === 'hi';
    },
  };

  await respond(ctx, 'hi', {});

  assert.equal(replied, true);
});
