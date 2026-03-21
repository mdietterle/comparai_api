const BaseScraper = require('./baseScraper');
const logger = require('../utils/logger');

class CooperScraper extends BaseScraper {
  /**
   * Extrai produtos da página de resultados do Cooper
   * @param {string} productName - Nome do produto a pesquisar
   * @returns {Promise<Array<{name: string, price: number, unit: string, supermarket: string}>>}
   */
  async scrapeProducts(productName) {
    const url = this.buildSearchUrl(productName);
    logger.info(`[Cooper] Pesquisando: "${productName}" -> ${url}`);

    let page;
    try {
      page = await this.createPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Aguarda os cards de produto
      await page.waitForSelector(
        '.product-variation, [class*="product-card"], [class*="product-item"]',
        { timeout: 15000 }
      ).catch(() => {
        logger.warn(`[Cooper] Timeout esperando cards para "${productName}"`);
      });

      // Aguarda carregamento dinâmico
      await new Promise((r) => setTimeout(r, 3000));

      const products = await page.evaluate(() => {
        const items = [];

        // Tenta diferentes seletores para cards de produto
        const cards = document.querySelectorAll(
          '.product-variation, [class*="product-card"], [class*="shelf-item"], [class*="product-item"]'
        );

        cards.forEach((card) => {
          try {
            // Nome do produto
            const nameEl = card.querySelector(
              '.product-variation__name, [class*="product-name"], [class*="productName"], h3, h4'
            );

            const name = nameEl?.textContent?.trim();
            if (!name) return;

            // Preço - tenta vários padrões
            const priceEl = card.querySelector(
              '.product-variation__price, [class*="product-price"], [class*="productPrice"], [class*="price"]'
            );

            let price = null;

            if (priceEl) {
              const priceText = priceEl.textContent
                .replace('R$', '')
                .replace(/\s/g, '')
                .replace(/\./g, '')
                .replace(',', '.');
              price = parseFloat(priceText);
            }

            // Fallback: procura preço em qualquer texto do card
            if (!price || isNaN(price)) {
              const allText = card.textContent;
              const priceMatch = allText.match(/R\$\s*([\d.]+,\d{2})/);
              if (priceMatch) {
                price = parseFloat(
                  priceMatch[1].replace(/\./g, '').replace(',', '.')
                );
              }
            }

            if (!price || isNaN(price)) return;

            items.push({ name, price });
          } catch (err) {
            // Ignora cards com problema
          }
        });

        return items;
      });

      logger.info(`[Cooper] Encontrados ${products.length} produtos para "${productName}"`);

      return products.map((p) => ({
        ...p,
        supermarket: 'Cooper',
      }));
    } catch (error) {
      logger.error(`[Cooper] Erro ao pesquisar "${productName}":`, error.message);
      return [];
    } finally {
      if (page) await page.close();
    }
  }
}

module.exports = CooperScraper;
