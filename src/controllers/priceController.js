const { searchAllSupermarkets } = require('../services/scraperService');
const { compareProducts } = require('../services/comparisonService');
const { saveShoppingList, savePriceSearch, getShoppingLists, getShoppingListByName } = require('../services/databaseService');
const logger = require('../utils/logger');

/**
 * Controller para comparação de preços
 *
 * POST /api/compare
 * Body: { "products": ["arroz", "feijão", "macarrão"] }
 */
async function compareHandler(req, res, next) {
  try {
    const { products } = req.body;

    // Validação
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: 'O campo "products" é obrigatório e deve ser um array não-vazio de strings.',
        example: { products: ['arroz', 'feijão', 'macarrão'] },
      });
    }

    if (products.some((p) => typeof p !== 'string' || p.trim().length === 0)) {
      return res.status(400).json({
        error: 'Todos os itens de "products" devem ser strings não-vazias.',
      });
    }

    const cleanProducts = products.map((p) => p.trim());
    const listName = req.body.listName?.trim() || 'Minha lista';

    logger.info(`Iniciando comparação para ${cleanProducts.length} produto(s): ${cleanProducts.join(', ')}`);
    const startTime = Date.now();

    // 1. Salva a lista de compras no banco
    const shoppingListId = await saveShoppingList(cleanProducts, listName);

    // 2. Pesquisa em todos os supermercados
    const resultsByStore = await searchAllSupermarkets(cleanProducts);

    // 3. Compara preços
    const comparison = compareProducts(resultsByStore, cleanProducts);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Comparação concluída em ${elapsed}s`);

    // 4. Salva os resultados para o dashboard (sem bloquear a resposta em caso de erro)
    savePriceSearch(shoppingListId, `${elapsed}s`, resultsByStore, cleanProducts)
      .catch((err) => logger.error('[DB] Erro ao salvar resultados:', err.message));

    return res.json({
      success: true,
      shoppingListId,
      elapsedTime: `${elapsed}s`,
      ...comparison,
    });
  } catch (error) {
    logger.error('Erro no compareHandler:', error);
    next(error);
  }
}

async function listShoppingListsHandler(_req, res, next) {
  try {
    const lists = await getShoppingLists();
    return res.json({ success: true, lists });
  } catch (error) {
    logger.error('Erro no listShoppingListsHandler:', error);
    next(error);
  }
}

/**
 * Executa a pesquisa de preços de uma lista salva pelo nome.
 *
 * GET /api/compare/list/:name
 */
async function compareByListNameHandler(req, res, next) {
  try {
    const listName = req.params.name?.trim();

    if (!listName) {
      return res.status(400).json({ error: 'Nome da lista é obrigatório.' });
    }

    const list = await getShoppingListByName(listName);

    if (!list) {
      return res.status(404).json({ error: `Lista "${listName}" não encontrada.` });
    }

    logger.info(`Pesquisando lista "${list.name}" (${list.products.length} produto(s))`);
    const startTime = Date.now();

    const resultsByStore = await searchAllSupermarkets(list.products);
    const comparison = compareProducts(resultsByStore, list.products);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Comparação concluída em ${elapsed}s`);

    savePriceSearch(list.id, `${elapsed}s`, resultsByStore, list.products)
      .catch((err) => logger.error('[DB] Erro ao salvar resultados:', err.message));

    return res.json({
      success: true,
      shoppingListId: list.id,
      listName: list.name,
      elapsedTime: `${elapsed}s`,
      ...comparison,
    });
  } catch (error) {
    logger.error('Erro no compareByListNameHandler:', error);
    next(error);
  }
}

module.exports = { compareHandler, listShoppingListsHandler, compareByListNameHandler };
