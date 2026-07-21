const puppeteer = require('puppeteer');
const cache = require('../config/cache');
const { limitarADosDecimales } = require('../utils/cotizaciones');

const BNA_URL = 'https://www.bna.com.ar/Personas';
const CACHE_KEY = 'euro:bna';

/**
 * Parsea un string de precio argentino al formato numérico.
 * Ej: "1.635,00" → 1635
 */
function parsePrecio(text) {
  const s = text.trim();
  // Argentine format: comma is decimal separator, dots are thousands separators
  if (s.includes(',')) {
    const parsed = parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    return limitarADosDecimales(parsed);
  }
  // US/standard format: dot is decimal separator — parse directly
  return limitarADosDecimales(parseFloat(s) || 0);
}

/**
 * Scraping de cotizaciones de Euro (Billete y Divisa) desde BNA.
 * @returns {Promise<Array>}
 */
async function getBnaEuro() {
  const cached = cache.get(CACHE_KEY);
  if (cached !== undefined) return cached;

  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.goto(BNA_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Intentamos esperar el selector principal; si falla, continuamos igual
    try {
      await page.waitForSelector('#billetes, .cotizacion', { timeout: 15000 });
    } catch (_) {
      try {
        await page.waitForSelector('table', { timeout: 5000 });
      } catch (__) {
        // seguimos de todas formas — extraemos lo que haya
      }
    }

    const resultado = await page.evaluate(() => {
      /**
       * Busca filas que contengan "Euro" en las tablas priorizando
       * #billetes y #divisas, con fallback a cualquier tabla.
       */
      function extraerFilasEuro(tableSelector) {
        const table = document.querySelector(tableSelector);
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.filter((row) => /euro/i.test(row.innerText || row.textContent));
      }

      function parsearFila(row) {
        const celdas = Array.from(row.querySelectorAll('td')).map(
          (td) => (td.innerText || td.textContent || '').trim()
        );
        return celdas;
      }

      const filasBilletes = extraerFilasEuro('#billetes');
      const filasDivisas = extraerFilasEuro('#divisas');

      const items = [];

      const procesarFila = (fila, tipoDefault) => {
        const celdas = parsearFila(fila);
        // BNA: [Moneda, Compra, Venta] (a veces más columnas)
        if (celdas.length < 3) return;
        const moneda = celdas[0];
        const compraStr = celdas[1];
        const ventaStr = celdas[2];

        // Determinamos el tipo según el texto de la celda moneda
        let tipo = tipoDefault;
        if (/billete/i.test(moneda)) tipo = 'billete';
        else if (/divisa/i.test(moneda)) tipo = 'divisa';

        items.push({ tipo, moneda: 'EUR', compraStr, ventaStr });
      };

      if (filasBilletes.length > 0) {
        filasBilletes.forEach((f) => procesarFila(f, 'billete'));
      }
      if (filasDivisas.length > 0) {
        filasDivisas.forEach((f) => procesarFila(f, 'divisa'));
      }

      // Fallback: buscar en cualquier tabla
      if (items.length === 0) {
        const tablas = Array.from(
          document.querySelectorAll('table.table, table')
        );
        for (const tabla of tablas) {
          const filas = Array.from(tabla.querySelectorAll('tr')).filter((r) =>
            /euro/i.test(r.innerText || r.textContent)
          );
          filas.forEach((f) => procesarFila(f, 'euro'));
          if (items.length > 0) break;
        }
      }

      return items;
    });

    if (resultado.length === 0) {
      throw new Error('No se encontraron cotizaciones de Euro en BNA');
    }

    const fechaActualizacion = new Date().toISOString();
    const cotizaciones = resultado.map((item) => ({
      tipo: item.tipo,
      moneda: item.moneda,
      compra: parsePrecio(item.compraStr),
      venta: parsePrecio(item.ventaStr),
      fuente: 'BNA',
      fechaActualizacion,
    }));

    const ttl = parseInt(process.env.CACHE_TTL, 10) || 300;
    cache.set(CACHE_KEY, cotizaciones, ttl);
    return cotizaciones;
  } catch (err) {
    throw new Error(`Error en scraping BNA: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { getBnaEuro };
