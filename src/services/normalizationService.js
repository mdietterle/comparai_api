const logger = require('../utils/logger');

/**
 * Padrões de unidade de medida para extração do nome do produto
 * Ordem importa: padrões mais específicos primeiro
 */
const UNIT_PATTERNS = [
  // Peso com multiplicador (ex: "12x500g", "6x1kg")
  /(\d+\s*x\s*\d+[\.,]?\d*\s*(?:kg|g|mg))/i,
  // Peso (ex: "1kg", "500g", "1,5kg")
  /(\d+[\.,]?\d*\s*(?:kg|g|mg))/i,
  // Volume com multiplicador (ex: "12x350ml")
  /(\d+\s*x\s*\d+[\.,]?\d*\s*(?:l|lt|lts|litro|litros|ml))/i,
  // Volume (ex: "1l", "500ml", "1,5l")
  /(\d+[\.,]?\d*\s*(?:l|lt|lts|litro|litros|ml))/i,
  // Unidades (ex: "12un", "6 unidades")
  /(\d+\s*(?:un|und|unid|unidade|unidades))/i,
];

/**
 * Normaliza uma unidade de medida para formato padrão
 * Ex: "1000g" -> "1KG", "500ML" -> "500ML", "1L" -> "1L"
 * @param {string} rawUnit
 * @returns {string}
 */
function normalizeUnit(rawUnit) {
  if (!rawUnit) return '';

  let unit = rawUnit.trim().toUpperCase();

  // Remove espaços internos
  unit = unit.replace(/\s+/g, '');

  // Normaliza variações de unidade
  unit = unit.replace(/LITROS?|LTS?/gi, 'L');
  unit = unit.replace(/UNIDADES?|UNID|UND/gi, 'UN');

  // Converte vírgula para ponto para parse numérico
  const numericPart = unit.replace(/[A-Z]/g, '').replace(',', '.');
  const unitPart = unit.replace(/[\d.,]/g, '');
  const value = parseFloat(numericPart);

  if (isNaN(value)) return unit;

  // Normaliza: 1000g -> 1KG, 1000ml -> 1L
  if (unitPart === 'G' && value >= 1000 && value % 1000 === 0) {
    return `${value / 1000}KG`;
  }
  if (unitPart === 'ML' && value >= 1000 && value % 1000 === 0) {
    return `${value / 1000}L`;
  }

  return `${value}${unitPart}`;
}

/**
 * Extrai o nome base e a unidade de medida de um nome de produto
 * Ex: "Arroz Urbano Parboilizado 1kg" -> { baseName: "ARROZ URBANO PARBOILIZADO", unit: "1KG" }
 * @param {string} fullName
 * @returns {{ baseName: string, unit: string }}
 */
function extractNameAndUnit(fullName) {
  if (!fullName) return { baseName: '', unit: '' };

  let name = fullName.trim();
  let unit = '';

  // Tenta encontrar a unidade de medida
  for (const pattern of UNIT_PATTERNS) {
    const match = name.match(pattern);
    if (match) {
      unit = match[1];
      // Remove a unidade do nome
      name = name.replace(match[0], '').trim();
      break;
    }
  }

  // Limpa o nome
  name = name
    // Remove palavras comuns que não ajudam na comparação
    .replace(/\b(tipo\s*\d+|pacote|pouch|saco|caixa|emb|embalagem|sachê|saché)\b/gi, '')
    // Remove traços, barras, e pontuação
    .replace(/[-/\\|]+/g, ' ')
    // Remove espaços múltiplos
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  return {
    baseName: name,
    unit: normalizeUnit(unit),
  };
}

/**
 * Gera uma chave de comparação normalizada para agrupar produtos iguais
 * @param {string} baseName
 * @param {string} unit
 * @returns {string}
 */
function generateComparisonKey(baseName, unit) {
  return `${baseName}|${unit}`;
}

/**
 * Normaliza a lista de produtos de um scraper
 * @param {Array<{name: string, price: number, supermarket: string}>} products
 * @returns {Array<{name: string, baseName: string, unit: string, comparisonKey: string, price: number, supermarket: string}>}
 */
function normalizeProducts(products) {
  return products.map((product) => {
    const { baseName, unit } = extractNameAndUnit(product.name);
    return {
      originalName: product.name,
      baseName,
      unit,
      comparisonKey: generateComparisonKey(baseName, unit),
      price: product.price,
      supermarket: product.supermarket,
    };
  });
}

module.exports = {
  extractNameAndUnit,
  normalizeUnit,
  generateComparisonKey,
  normalizeProducts,
};
