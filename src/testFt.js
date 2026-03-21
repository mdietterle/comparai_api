// Teste: URL com ft= (full-text) vs path para busca multi-palavras
async function test() {
  const term = 'sabonete dove';

  const urls = [
    // Path (atual - incorreto para multi-palavras):
    `https://www.angeloni.com.br/super/api/catalog_system/pub/products/search/${encodeURIComponent(term)}?_from=0&_to=9`,
    // ft= (full-text search - correto):
    `https://www.angeloni.com.br/super/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=9`,
    // Giassi ft=:
    `https://www.giassi.com.br/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=9`,
  ];

  for (const url of urls) {
    const label = url.includes('giassi') ? '[Giassi]' : '[Angeloni]';
    const type = url.includes('?ft=') ? 'ft=' : 'path';
    console.log(`\n${label} ${type}: ${url.substring(0, 90)}...`);
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      const data = await resp.json();
      console.log(`  Status: ${resp.status} | Resultados: ${Array.isArray(data) ? data.length : '?'}`);
      if (Array.isArray(data) && data[0]) console.log(`  Primeiro: ${data[0].productName}`);
    } catch(e) {
      console.error(`  Erro: ${e.message}`);
    }
  }
}
test();
