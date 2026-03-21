const supermarketsConfig = require('../config/supermarkets.json');
const AngeloniScraper = require('../scrapers/angeloniScraper');
const GiassiScraper = require('../scrapers/giassiScraper');
const CooperScraper = require('../scrapers/cooperScraper');
const { normalizeProducts } = require('./normalizationService');
const logger = require('../utils/logger');

// Mapeamento de IDs para classes de scraper
const SCRAPER_CLASSES = {
  angeloni: AngeloniScraper,
  giassi: GiassiScraper,
  cooper: CooperScraper,
};

/**
 * Pesquisa produtos em todos os supermercados
 *
 * @param {string[]} productNames - Lista de nomes de produtos a pesquisar
 * @returns {Promise<Object>} Resultados normalizados por supermercado
 */
async function searchAllSupermarkets(productNames) {
  const scrapers = [];
  const results = {};

  try {
    // Cria e inicializa os scrapers
    for (const config of supermarketsConfig.supermarkets) {
      const ScraperClass = SCRAPER_CLASSES[config.id];
      if (!ScraperClass) {
        logger.warn(`Scraper não encontrado para: ${config.id}`);
        continue;
      }

      const scraper = new ScraperClass(config);
      await scraper.launch();
      scrapers.push({ scraper, config });
      results[config.name] = [];
    }

    // Para cada produto, pesquisa em todos os supermercados
    for (const productName of productNames) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Pesquisando: "${productName}"`);
      logger.info(`${'='.repeat(60)}`);

      // Pesquisa em paralelo nos 3 supermercados
      const searchPromises = scrapers.map(async ({ scraper, config }) => {
        try {
          const products = await scraper.scrapeProducts(productName);
          return { storeName: config.name, products };
        } catch (error) {
          logger.error(`Erro ao pesquisar "${productName}" em ${config.name}:`, error.message);
          return { storeName: config.name, products: [] };
        }
      });

      const searchResults = await Promise.all(searchPromises);

      // Agrega resultados e normaliza
      for (const { storeName, products } of searchResults) {
        const normalized = normalizeProducts(products);
        results[storeName].push(...normalized);

        // Log para desenvolvimento/validação
        logger.debug(`[${storeName}] Produtos encontrados para "${productName}":`);
        normalized.forEach((p) => {
          logger.debug(`  - ${p.originalName} | ${p.baseName} | ${p.unit} | R$ ${p.price.toFixed(2)}`);
        });
      }
    }
  } finally {
    // Garante que todos os browsers são fechados
    for (const { scraper } of scrapers) {
      await scraper.close().catch((err) =>
        logger.error('Erro ao fechar browser:', err.message)
      );
    }
  }

  return results;
}

module.exports = { searchAllSupermarkets };
