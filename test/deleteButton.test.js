const assert = require('node:assert/strict');
const test = require('node:test');

const { __test } = require('../bot');

function createCtx(userId = 10) {
  const calls = { deleteMessage: [], editMessageText: [], answer: [] };
  const api = {
    deleteMessage: async (...args) => calls.deleteMessage.push(args),
    editMessageText: async (...args) => calls.editMessageText.push(args),
    editMessageReplyMarkup: async () => {},
    getChatMember: async () => ({ status: 'member' }),
  };
  return {
    ctx: {
      from: { id: userId },
      callbackQuery: { id: 'cb1' },
      api,
      answerCallbackQuery: async (payload) => calls.answer.push(payload || {}),
    },
    calls,
  };
}

test('delete button rejects unauthorized user', async () => {
  const { ctx, calls } = createCtx(11);
  const result = await __test.handleDeleteMessageCallback(ctx, 'msgdel:10:1:100');
  assert.equal(result.ok, false);
  assert.equal(calls.deleteMessage.length, 0);
});

test('delete button deletes target message for owner', async () => {
  const { ctx, calls } = createCtx(10);
  const result = await __test.handleDeleteMessageCallback(ctx, 'msgdel:10:1:100');
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'deleted');
  assert.deepEqual(calls.deleteMessage[0], [1, 100]);
});


test('delete button allows group admin', async () => {
  const { ctx, calls } = createCtx(11);
  ctx.callbackQuery.message = { chat: { id: 1, type: 'group' } };
  ctx.api.getChatMember = async () => ({ status: 'administrator' });
  const result = await __test.handleDeleteMessageCallback(ctx, 'msgdel:10:1:100');
  assert.equal(result.ok, true);
  assert.deepEqual(calls.deleteMessage[0], [1, 100]);
});
