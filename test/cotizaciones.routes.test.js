const test = require('node:test');
const assert = require('node:assert/strict');

test('BNA dollar endpoint is additive and does not shadow DolarAPI routes', async (t) => {
  const dolarServicePath = require.resolve('../src/services/dolarApi.service');
  const bnaServicePath = require.resolve('../src/services/bna.service');
  const controllerPath = require.resolve('../src/controllers/cotizaciones.controller');
  const routesPath = require.resolve('../src/routes/cotizaciones.routes');
  const appPath = require.resolve('../app');
  const originalDolarService = require(dolarServicePath);
  const originalBnaService = require(bnaServicePath);

  const dolarApiAll = [{ casa: 'oficial', compra: 1200, venta: 1250 }];
  const dolarApiTipo = { casa: 'blue', compra: 1300, venta: 1320 };
  const dolarBna = [
    { tipo: 'billete', moneda: 'USD', compra: 1200, venta: 1250, fuente: 'BNA', fechaActualizacion: '2026-07-24T12:00:00.000Z' },
    { tipo: 'divisa', moneda: 'USD', compra: 1205, venta: 1255, fuente: 'BNA', fechaActualizacion: '2026-07-24T12:00:00.000Z' },
  ];
  const euroBna = [
    { tipo: 'billete', moneda: 'EUR', compra: 1400, venta: 1450, fuente: 'BNA', fechaActualizacion: '2026-07-24T12:00:00.000Z' },
  ];

  require.cache[dolarServicePath].exports = {
    getAllDolar: async () => dolarApiAll,
    getDolarByTipo: async () => dolarApiTipo,
  };
  require.cache[bnaServicePath].exports = {
    getBnaDollar: async () => dolarBna,
    getBnaEuro: async () => euroBna,
  };
  [controllerPath, routesPath, appPath].forEach((path) => delete require.cache[path]);

  const app = require(appPath);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/cotizaciones`;

  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    require.cache[dolarServicePath].exports = originalDolarService;
    require.cache[bnaServicePath].exports = originalBnaService;
    [controllerPath, routesPath, appPath].forEach((path) => delete require.cache[path]);
  });

  const [bnaResponse, allDolarResponse, typedResponse, aggregateResponse] =
    await Promise.all([
      fetch(`${baseUrl}/dolar/bna`),
      fetch(`${baseUrl}/dolar`),
      fetch(`${baseUrl}/dolar/blue`),
      fetch(baseUrl),
    ]);

  assert.deepEqual(await bnaResponse.json(), dolarBna);
  assert.deepEqual(await allDolarResponse.json(), dolarApiAll);
  assert.deepEqual(await typedResponse.json(), dolarApiTipo);

  const aggregate = await aggregateResponse.json();
  assert.deepEqual(aggregate.dolar, dolarApiAll);
  assert.deepEqual(aggregate.dolarBna, dolarBna);
  assert.deepEqual(aggregate.euro, euroBna);
  assert.ok(!Number.isNaN(Date.parse(aggregate.fechaConsulta)));
});
