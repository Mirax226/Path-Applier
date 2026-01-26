const { startBot } = require('../bot.js');

startBot().catch((error) => {
  console.error('Failed to start bot', error?.stack || error);
});
