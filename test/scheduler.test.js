const test = require('node:test');
const assert = require('node:assert/strict');

test('scheduler warms DolarAPI and both BNA currency caches on startup', async (t) => {
  const dolarServicePath = require.resolve('../src/services/dolarApi.service');
  const bnaServicePath = require.resolve('../src/services/bna.service');
  const schedulerPath = require.resolve('../src/scheduler');
  const originalDolarService = require(dolarServicePath);
  const originalBnaService = require(bnaServicePath);
  const originalSetInterval = global.setInterval;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const calls = [];
  let scheduledInterval;

  require.cache[dolarServicePath].exports = {
    getAllDolar: async () => calls.push('dolar:all'),
  };
  require.cache[bnaServicePath].exports = {
    getBnaDollar: async () => calls.push('dolar:bna'),
    getBnaEuro: async () => calls.push('euro:bna'),
  };
  global.setInterval = (callback, interval) => {
    scheduledInterval = { callback, interval };
    return 1;
  };
  console.log = () => {};
  console.error = () => {};
  delete require.cache[schedulerPath];

  t.after(() => {
    require.cache[dolarServicePath].exports = originalDolarService;
    require.cache[bnaServicePath].exports = originalBnaService;
    global.setInterval = originalSetInterval;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    delete require.cache[schedulerPath];
  });

  require(schedulerPath).start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls, ['dolar:all', 'dolar:bna', 'euro:bna']);
  assert.equal(scheduledInterval.interval, 30 * 60 * 1000);
  assert.equal(typeof scheduledInterval.callback, 'function');
});
