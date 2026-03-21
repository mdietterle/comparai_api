require('dotenv').config();

/**
 * Script utilitário para testar a API de comparação de preços.
 * Uso: node src/testApi.js [produto1] [produto2] ...
 * Exemplo: node src/testApi.js arroz feijao leite
 *
 * A API deve estar rodando (npm run dev) antes de executar este script.
 */
async function testApi() {
  const products = process.argv.slice(2);

  if (products.length === 0) {
    products.push('arroz', 'feijao');
    console.log('Nenhum produto informado. Usando padrão: arroz, feijao\n');
  }

  const port = process.env.PORT || 3000;
  const baseUrl = `http://localhost:${port}`;

  console.log(`Testando POST ${baseUrl}/api/compare com: [${products.join(', ')}]\n`);
  const startTime = Date.now();

  const response = await fetch(`${baseUrl}/api/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products }),
  });

  const data = await response.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`Status: ${response.status} (${elapsed}s)\n`);

  if (!data.success) {
    console.log('Erro:', JSON.stringify(data, null, 2));
    return;
  }

  // 1. Supermercado mais barato
  if (data.cheapestSupermarket) {
    const c = data.cheapestSupermarket;
    console.log(`════════════════════════════════════════════════`);
    console.log(`✅ SUPERMERCADO MAIS BARATO: ${c.name}`);
    console.log(`   Total: R$ ${c.totalCost.toFixed(2)} (${c.itemsFound} de ${products.length} itens encontrados)`);
    console.log(`────────────────────────────────────────────────`);
    for (const p of c.products) {
      console.log(`  [${p.searchTerm}] ${p.name} (${p.unit}) → R$ ${p.price.toFixed(2)}`);
    }
  } else {
    console.log('Nenhum supermercado encontrado para comparação.');
    return;
  }

  // 2. Demais supermercados
  console.log(`\n════════════════════════════════════════════════`);
  console.log(`🏪 DEMAIS SUPERMERCADOS`);
  for (const store of data.otherSupermarkets || []) {
    console.log(`\n  ${store.name} — Total: R$ ${store.totalCost.toFixed(2)} (${store.itemsFound} de ${products.length} itens)`);
    console.log(`  ────────────────────────────────────`);
    if (store.products.length === 0) {
      console.log(`    (nenhum item encontrado)`);
    }
    for (const p of store.products) {
      console.log(`    [${p.searchTerm}] ${p.name} (${p.unit}) → R$ ${p.price.toFixed(2)}`);
    }
  }

  // 3. Comparativo de economia
  if (data.savingsComparison && data.savingsComparison.length > 0) {
    console.log(`\n════════════════════════════════════════════════`);
    console.log(`💰 COMPARATIVO DE ECONOMIA (vs ${data.cheapestSupermarket.name})`);
    for (const s of data.savingsComparison) {
      const sign = s.savings >= 0 ? '+' : '';
      console.log(`  ${s.comparedTo}: R$ ${s.totalCostAtOtherStore.toFixed(2)} → economiza R$ ${sign}${s.savings.toFixed(2)} (${s.savingsPercent}%)`);
    }
  }

  console.log(`\n════════════════════════════════════════════════\n`);
}

testApi().catch(console.error);
