require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Salva a lista de compras e retorna o ID criado.
 * Se a lista já existir pelo nome, reaproveita o ID.
 * @param {string[]} products
 * @param {string} listName
 * @returns {Promise<string>} shopping_list_id
 */
async function saveShoppingList(products, listName = 'Minha lista') {
  // Cria a lista
  const { data: list, error: listError } = await supabase
    .from('shopping_lists')
    .insert({ name: listName })
    .select('id')
    .single();

  if (listError) throw new Error(`Erro ao salvar lista: ${listError.message}`);

  // Insere os itens
  const items = products.map((product_name) => ({
    shopping_list_id: list.id,
    product_name,
  }));

  const { error: itemsError } = await supabase
    .from('shopping_list_items')
    .insert(items);

  if (itemsError) throw new Error(`Erro ao salvar itens: ${itemsError.message}`);

  logger.debug(`[DB] Lista salva: ${list.id} (${products.length} itens)`);
  return list.id;
}

/**
 * Salva o resultado de uma pesquisa de preços.
 * @param {string} shoppingListId
 * @param {string} elapsedTime
 * @param {Object} resultsByStore - { "Angeloni": [...normalizedProducts], ... }
 * @param {string[]} searchTerms
 * @returns {Promise<string>} price_search_id
 */
async function savePriceSearch(shoppingListId, elapsedTime, resultsByStore, searchTerms) {
  // Cria o registro da pesquisa
  const { data: search, error: searchError } = await supabase
    .from('price_searches')
    .insert({ shopping_list_id: shoppingListId, elapsed_time: elapsedTime })
    .select('id')
    .single();

  if (searchError) throw new Error(`Erro ao salvar pesquisa: ${searchError.message}`);

  // Monta os resultados por supermercado
  const results = [];

  for (const [supermarket, products] of Object.entries(resultsByStore)) {
    for (const product of products) {
      // Só salva produtos que correspondem a algum termo da lista
      const matchedTerm = searchTerms.find((term) =>
        matchesSearchTerm(product.originalName || product.baseName || '', term)
      );
      if (!matchedTerm) continue;

      results.push({
        price_search_id: search.id,
        search_term: matchedTerm,
        supermarket,
        product_name: product.originalName || product.baseName,
        unit: product.unit || null,
        price: product.price,
      });
    }
  }

  if (results.length > 0) {
    const { error: resultsError } = await supabase
      .from('price_results')
      .insert(results);

    if (resultsError) throw new Error(`Erro ao salvar resultados: ${resultsError.message}`);
  }

  logger.debug(`[DB] Pesquisa salva: ${search.id} (${results.length} resultados)`);
  return search.id;
}

/**
 * Verifica a correspondência de palavras (mesma lógica do comparisonService)
 */
function matchesSearchTerm(productName, searchTerm) {
  const normalize = (str) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const normalizedProduct = normalize(productName);
  const searchWords = normalize(searchTerm).split(' ').filter(Boolean);
  return searchWords.every((word) => normalizedProduct.includes(word));
}

/**
 * Lista todas as listas de compras com seus itens.
 * @returns {Promise<Array>}
 */
async function getShoppingLists() {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(`
      id,
      name,
      created_at,
      shopping_list_items ( product_name )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Erro ao buscar listas: ${error.message}`);

  return data.map((list) => ({
    id: list.id,
    name: list.name,
    createdAt: list.created_at,
    products: list.shopping_list_items.map((i) => i.product_name),
  }));
}

/**
 * Busca uma lista de compras pelo nome e retorna seus produtos.
 * @param {string} listName
 * @returns {Promise<{ id: string, name: string, products: string[] } | null>}
 */
async function getShoppingListByName(listName) {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(`
      id,
      name,
      shopping_list_items ( product_name )
    `)
    .ilike('name', listName)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Erro ao buscar lista: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    products: data.shopping_list_items.map((i) => i.product_name),
  };
}

module.exports = { saveShoppingList, savePriceSearch, getShoppingLists, getShoppingListByName };
