const test = require('node:test');
const assert = require('node:assert/strict');

const cache = require('../src/config/cache');

test('BNA currencies share one browser scrape and retain distinct quotation types', async (t) => {
  cache.flushAll();

  const puppeteerPath = require.resolve('puppeteer');
  const servicePath = require.resolve('../src/services/bna.service');
  const originalPuppeteer = require(puppeteerPath);
  let launchCount = 0;
  let closeCount = 0;

  require.cache[puppeteerPath].exports = {
    launch: async () => {
      launchCount += 1;
      return {
        newPage: async () => ({
          goto: async () => {},
          waitForSelector: async () => {},
          evaluate: async () => [
            { tipo: 'billete', moneda: 'EUR', compraStr: '1.635,25', ventaStr: '1.735,50' },
            { tipo: 'divisa', moneda: 'EUR', compraStr: '1.640,00', ventaStr: '1.740,00' },
            { tipo: 'billete', moneda: 'USD', compraStr: '1.200,25', ventaStr: '1.250,20' },
            { tipo: 'divisa', moneda: 'USD', compraStr: '1.205,30', ventaStr: '1.255,40' },
          ],
        }),
        close: async () => {
          closeCount += 1;
        },
      };
    },
  };
  delete require.cache[servicePath];

  t.after(() => {
    require.cache[puppeteerPath].exports = originalPuppeteer;
    delete require.cache[servicePath];
    cache.flushAll();
  });

  const { getBnaEuro, getBnaDollar } = require(servicePath);
  const [euro, dollar] = await Promise.all([getBnaEuro(), getBnaDollar()]);

  assert.equal(launchCount, 1);
  assert.equal(closeCount, 1);
  assert.deepEqual(dollar.map(({ tipo, moneda }) => ({ tipo, moneda })), [
    { tipo: 'billete', moneda: 'USD' },
    { tipo: 'divisa', moneda: 'USD' },
  ]);
  assert.equal(dollar[0].compra, 1200.25);
  assert.equal(dollar[1].venta, 1255.4);
  assert.ok(dollar.every((item) => item.fuente === 'BNA'));
  assert.ok(dollar.every((item) => !Number.isNaN(Date.parse(item.fechaActualizacion))));
  assert.ok(euro.every((item) => item.moneda === 'EUR'));
});
