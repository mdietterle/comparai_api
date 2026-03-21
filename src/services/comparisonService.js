const logger = require('../utils/logger');

/**
 * Normaliza string removendo acentos, espaços extras e convertendo para minúsculas
 * @param {string} str
 * @returns {string}
 */
function normalizeStr(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se um nome de produto contém todas as palavras do termo de busca.
 * Permite palavras extras no nome (ex: "farinha de trigo especial 5kg" bate com "farinha de trigo 5kg").
 * @param {string} productName
 * @param {string} searchTerm
 * @returns {boolean}
 */
function matchesSearchTerm(productName, searchTerm) {
  const normalizedProduct = normalizeStr(productName);
  const searchWords = normalizeStr(searchTerm).split(' ').filter(Boolean);
  return searchWords.every(word => normalizedProduct.includes(word));
}

/**
 * Compara preços entre supermercados e identifica o mais barato
 *
 * A lógica de comparação funciona assim:
 * 1. Agrupa os produtos de TODOS os supermercados pela chave de comparação (nome + unidade EXATOS)
 * 2. Para cada produto encontrado em MAIS DE UM supermercado, registra os preços
 * 3. Calcula o total da compra de cada supermercado somando o menor preço
 *    de cada produto encontrado naquele mercado
 * 4. Indica o supermercado com o menor total global
 *
 * @param {Object} resultsByStore - { "Angeloni": [...normalizedProducts], "Giassi": [...], "Cooper": [...] }
 * @param {string[]} searchTerms - Termos de pesquisa originais
 * @returns {Object} Resultado da comparação
 */
function compareProducts(resultsByStore, searchTerms) {
  const storeNames = Object.keys(resultsByStore);
  const storeTotals = {};
  const storeProductCount = {};
  const storeProducts = {};

  for (const storeName of storeNames) {
    storeTotals[storeName] = 0;
    storeProductCount[storeName] = 0;
    storeProducts[storeName] = [];
  }

  const productComparison = [];
  let totalUniqueProducts = 0;

  for (const storeName of storeNames) {
    totalUniqueProducts += (resultsByStore[storeName] || []).length;
  }

  const cheapestGlobalList = {
    totalCost: 0,
    products: []
  };

  // Para cada item da lista (searchTerm), pegar 1 produto (o mais barato) por supermercado
  for (const term of searchTerms) {
    const cheapestPerStoreForTerm = {};

    for (const storeName of storeNames) {
      const storeItems = resultsByStore[storeName] || [];
      
      // Encontra todos os itens que dão match com o termo (todas as palavras presentes)
      const matchingItems = storeItems.filter(p => {
        const name = p.originalName || p.baseName || '';
        return matchesSearchTerm(name, term);
      });

      if (matchingItems.length > 0) {
        // Seleciona o mais barato daquela loja
        const cheapestItem = matchingItems.reduce((min, curr) => curr.price < min.price ? curr : min, matchingItems[0]);
        cheapestPerStoreForTerm[storeName] = cheapestItem;

        // Soma ao total da loja (carrinho fechado em uma loja)
        storeTotals[storeName] += cheapestItem.price;
        storeProductCount[storeName]++;
        // O objeto completo de comparação é montado após o loop de lojas, abaixo
        storeProducts[storeName].push({ searchTerm: term, _item: cheapestItem });
      }
    }

    // Calcula o mais barato GERAL (entre TODAS as lojas) para este termo
    let cheapestOverallStore = '';
    let cheapestOverallPrice = Infinity;
    let cheapestItemGlobal = null;
    const pricesObj = {};
    const namesObj = {};

    for (const [store, item] of Object.entries(cheapestPerStoreForTerm)) {
      pricesObj[store] = item.price;
      namesObj[store] = item.originalName || item.baseName;
      if (item.price < cheapestOverallPrice) {
        cheapestOverallPrice = item.price;
        cheapestOverallStore = store;
        cheapestItemGlobal = item;
      }
    }

    // Apenas se encontrou o item em alguma loja, adiciona à lista mista global
    if (cheapestItemGlobal) {
      cheapestGlobalList.products.push({
        searchTerm: term,
        supermarket: cheapestOverallStore,
        name: cheapestItemGlobal.originalName || cheapestItemGlobal.baseName,
        price: cheapestOverallPrice,
        unit: cheapestItemGlobal.unit
      });
      cheapestGlobalList.totalCost += cheapestOverallPrice;
    }

    // Enriquecer storeProducts com comparação de preços das demais lojas
    for (const storeName of storeNames) {
      const entry = storeProducts[storeName].find(e => e.searchTerm === term && e._item);
      if (!entry) continue;

      const thisPrice = entry._item.price;

      // Menor preço das outras lojas para o mesmo termo
      const otherPrices = Object.entries(cheapestPerStoreForTerm)
        .filter(([s]) => s !== storeName)
        .map(([s, it]) => ({ store: s, price: it.price }));

      const cheapestOther = otherPrices.length > 0
        ? otherPrices.reduce((min, c) => c.price < min.price ? c : min)
        : null;

      // Substitui o placeholder pelo objeto final
      const idx = storeProducts[storeName].indexOf(entry);
      storeProducts[storeName][idx] = {
        searchTerm: term,
        name: entry._item.originalName || entry._item.baseName,
        unit: entry._item.unit,
        price: thisPrice,
        priceInOtherStores: cheapestOther
          ? { store: cheapestOther.store, price: cheapestOther.price }
          : null,
        savings: cheapestOther
          ? Math.round((cheapestOther.price - thisPrice) * 100) / 100
          : null,
      };
    }

    // Formatações para manter a estrutura original de productComparison
    const matchedProducts = Object.keys(cheapestPerStoreForTerm).length > 0 ? [{
      name: `Seleção mais barata para "${term}"`,
      unit: '-',
      originalNames: namesObj,
      prices: pricesObj,
      cheapest: cheapestOverallStore,
      cheapestPrice: cheapestOverallPrice,
    }] : [];

    productComparison.push({
      searchTerm: term,
      matchedProducts,
    });
  }

  // Identificar o supermercado mais barato global (carrinho fechado na mesma loja)
  let cheapestStore = null;
  let cheapestTotal = Infinity;
  const maxItemsFound = Math.max(0, ...Object.values(storeProductCount));

  for (const [storeName, total] of Object.entries(storeTotals)) {
    if (storeProductCount[storeName] > 0 && storeProductCount[storeName] === maxItemsFound) {
      if (total < cheapestTotal) {
        cheapestTotal = total;
        cheapestStore = storeName;
      }
    }
  }

  if (!cheapestStore) {
    for (const [storeName, total] of Object.entries(storeTotals)) {
      if (storeProductCount[storeName] > 0 && total < cheapestTotal) {
        cheapestTotal = total;
        cheapestStore = storeName;
      }
    }
  }

  return {
    cheapestSupermarket: cheapestStore
      ? {
          name: cheapestStore,
          totalCost: Math.round(cheapestTotal * 100) / 100,
          itemsFound: storeProductCount[cheapestStore],
          products: storeProducts[cheapestStore].map(p => ({
            searchTerm: p.searchTerm,
            name: p.name,
            unit: p.unit,
            price: p.price,
          })),
        }
      : null,

    otherSupermarkets: storeNames
      .filter(name => name !== cheapestStore)
      .map(name => ({
        name,
        totalCost: Math.round(storeTotals[name] * 100) / 100,
        itemsFound: storeProductCount[name],
        products: (storeProducts[name] || []).map(p => ({
          searchTerm: p.searchTerm,
          name: p.name,
          unit: p.unit,
          price: p.price,
        })),
      })),

    savingsComparison: cheapestStore
      ? storeNames
          .filter(name => name !== cheapestStore && storeProductCount[name] > 0)
          .map(otherStore => {
            const diff = Math.round((storeTotals[otherStore] - cheapestTotal) * 100) / 100;
            return {
              comparedTo: otherStore,
              totalCostAtOtherStore: Math.round(storeTotals[otherStore] * 100) / 100,
              totalCostAtCheapest: Math.round(cheapestTotal * 100) / 100,
              savings: diff,
              savingsPercent: storeTotals[otherStore] > 0
                ? Math.round((diff / storeTotals[otherStore]) * 10000) / 100
                : 0,
            };
          })
      : [],
  };
}

module.exports = { compareProducts };
