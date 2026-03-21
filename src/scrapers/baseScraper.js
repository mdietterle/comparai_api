const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class BaseScraper {
  constructor(supermarketConfig) {
    this.config = supermarketConfig;
    this.browser = null;
  }

  /**
   * Monta a URL de pesquisa substituindo o placeholder {query}
   * @param {string} productName - Nome do produto a pesquisar
   * @returns {string} URL completa de pesquisa
   */
  buildSearchUrl(productName) {
    const encoded = encodeURIComponent(productName);
    return this.config.searchUrl.replace(/\{query\}/g, encoded);
  }

  /**
   * Inicia o browser headless
   */
  async launch() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
        ],
      });
      logger.debug(`[${this.config.name}] Browser iniciado`);
    }
  }

  /**
   * Fecha o browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.debug(`[${this.config.name}] Browser fechado`);
    }
  }

  /**
   * Cria uma nova página com configurações padrão
   * @returns {import('puppeteer').Page}
   */
  async createPage() {
    const page = await this.browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });

    // Remove webdriver flag para evitar detecção
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Bloqueia apenas imagens e media para performance (mantém CSS e JS)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  /**
   * Método abstrato - deve ser implementado por cada scraper
   * @param {string} productName - Nome do produto
   * @returns {Promise<Array<{name: string, price: number, unit: string}>>}
   */
  async scrapeProducts(productName) {
    throw new Error('scrapeProducts deve ser implementado pela subclasse');
  }
}

module.exports = BaseScraper;
