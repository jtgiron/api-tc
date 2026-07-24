const test = require('node:test');
const assert = require('node:assert/strict');

const cache = require('../src/config/cache');

function createRow(moneda, compra, venta) {
  const cells = [moneda, compra, venta].map((text) => ({
    innerText: text,
    textContent: text,
  }));
  return {
    innerText: cells.map(({ innerText }) => innerText).join(' '),
    querySelectorAll: (selector) => (selector === 'td' ? cells : []),
  };
}

function createTable(id, rows) {
  return {
    id,
    className: 'table',
    querySelectorAll: (selector) => (selector === 'tr' ? rows : []),
  };
}

test('BNA currencies share one browser scrape and retain distinct quotation types', async (t) => {
  cache.flushAll();

  const puppeteerPath = require.resolve('puppeteer');
  const servicePath = require.resolve('../src/services/bna.service');
  const originalPuppeteer = require(puppeteerPath);
  let launchCount = 0;
  let closeCount = 0;
  const tables = {
    '#billetes': createTable('billetes', [
      createRow('Euro', '1.635,25', '1.735,50'),
      createRow('Dólar U.S.A.', '1.200,25', '1.250,20'),
      createRow('Dólar Canadiense', '800,00', '850,00'),
      createRow('Dólar U.S.A. Australiano', '700,00', '750,00'),
    ]),
    '#divisas': createTable('divisas', [
      createRow('Euro', '1.640,00', '1.740,00'),
      createRow('  dOlAr  U . S . A  ', '1.205,30', '1.255,40'),
      createRow('Dolar Australiano', '600,00', '650,00'),
      createRow('Dólar', '500,00', '550,00'),
    ]),
  };
  const document = {
    querySelector: (selector) => tables[selector] || null,
    querySelectorAll: (selector) =>
      selector === 'table.table, table' ? Object.values(tables) : [],
  };

  require.cache[puppeteerPath].exports = {
    launch: async () => {
      launchCount += 1;
      return {
        newPage: async () => ({
          goto: async () => {},
          waitForSelector: async () => {},
          evaluate: async (callback, currencies) => {
            const originalDocument = global.document;
            global.document = document;
            try {
              return callback(currencies);
            } finally {
              global.document = originalDocument;
            }
          },
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
