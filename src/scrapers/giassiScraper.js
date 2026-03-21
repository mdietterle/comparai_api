const logger = require('../utils/logger');

/**
 * Scraper Giassi via VTEX Catalog API (REST)
 * Não usa Puppeteer - faz chamadas HTTP diretas à API VTEX
 */
class GiassiScraper {
  constructor(supermarketConfig) {
    this.config = supermarketConfig;
    this.apiBaseUrl = 'https://www.giassi.com.br/api/catalog_system/pub/products/search';
    this.maxResults = 50;
  }

  async launch() {
    logger.debug(`[${this.config.name}] Scraper API inicializado`);
  }

  async close() {
    logger.debug(`[${this.config.name}] Scraper API finalizado`);
  }

  /**
   * Pesquisa produtos via API VTEX Catalog
   * @param {string} productName - Nome do produto a pesquisar
   * @returns {Promise<Array<{name: string, price: number, supermarket: string}>>}
   */
  async scrapeProducts(productName) {
    logger.info(`[Giassi] Pesquisando via API: "${productName}"`);

    try {
      const products = [];
      const pageSize = 50;
      let from = 0;

      while (from < this.maxResults) {
        const to = Math.min(from + pageSize - 1, this.maxResults - 1);
        const url = `${this.apiBaseUrl}?ft=${encodeURIComponent(productName)}&_from=${from}&_to=${to}`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          logger.warn(`[Giassi] API retornou ${response.status} para "${productName}"`);
          break;
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) break;

        for (const item of data) {
          const parsed = this._parseProduct(item);
          if (parsed) {
            products.push(parsed);
          }
        }

        if (data.length < pageSize) break;
        from += pageSize;
      }

      logger.info(`[Giassi] Encontrados ${products.length} produtos para "${productName}"`);
      return products;
    } catch (error) {
      logger.error(`[Giassi] Erro ao pesquisar "${productName}":`, error.message);
      return [];
    }
  }

  /**
   * Extrai dados relevantes de um produto da API VTEX
   * @param {Object} item - Produto da API VTEX
   * @returns {{ name: string, price: number, supermarket: string } | null}
   */
  _parseProduct(item) {
    try {
      const name = item.productName;
      if (!name) return null;

      for (const sku of item.items || []) {
        for (const seller of sku.sellers || []) {
          const offer = seller.commertialOffer;
          if (offer && offer.IsAvailable && offer.Price > 0) {
            return {
              name: sku.name || name,
              price: offer.Price,
              supermarket: 'Giassi',
            };
          }
        }
      }

      return null;
    } catch (err) {
      return null;
    }
  }
}

module.exports = GiassiScraper;
