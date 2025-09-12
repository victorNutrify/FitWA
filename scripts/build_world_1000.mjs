// scripts/build_world_1000.mjs
import fs from "fs";
import fetch from "node-fetch";

const OUTPUT_FILE = "alimentos_br.json";

// categorias globais (você pode expandir depois)
const CATEGORIES = [
  "en:cereals-and-their-products",
  "en:meats",
  "en:fruits",
  "en:vegetables",
  "en:legumes",
  "en:seafood",
  "en:beverages",
  "en:snacks",
  "en:dairies",
  "en:nuts",
  "en:seeds",
  "en:fats",
  "en:sweets"
];

const MAX_PAGES = 5; // só 5 páginas por categoria
const PAGE_SIZE = 50; // cada página = até 50 produtos

async function fetchCategory(category) {
  let results = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`🔍 Categoria=${category}, página=${page}`);

    // primeira tentativa: Brasil + português
    let url = `https://world.openfoodfacts.org/api/v2/search?categories_tags=${category}&page=${page}&page_size=${PAGE_SIZE}&fields=code,product_name,lang,languages_tags,countries_tags,nutriments,serving_size&lc=pt&countries_tags=en:brazil`;

    let res = await fetch(url, { headers: { "User-Agent": "FitWA/1.0" } });
    let json = await res.json();
    let products = json.products || [];

    // fallback: só português
    if (products.length === 0) {
      console.log(`⚠️ Nenhum produto (Brasil). Tentando só português...`);
      url = `https://world.openfoodfacts.org/api/v2/search?categories_tags=${category}&page=${page}&page_size=${PAGE_SIZE}&fields=code,product_name,lang,languages_tags,countries_tags,nutriments,serving_size&lc=pt`;
      res = await fetch(url, { headers: { "User-Agent": "FitWA/1.0" } });
      json = await res.json();
      products = json.products || [];
    }

    for (const p of products) {
      if (!p.product_name) continue;

      const nutr = p.nutriments || {};
      const item = {
        name: p.product_name,
        category: category,
        portion_grams: 100,
        nutriments: {
          calories: Number(
            nutr["energy-kcal_100g"] ??
              (nutr.energy_100g ? nutr.energy_100g * 0.239 : 0)
          ),
          protein_g: Number(nutr.proteins_100g ?? 0),
          carbs_g: Number(nutr.carbohydrates_100g ?? 0),
          fat_g: Number(nutr.fat_100g ?? 0)
        },
        source: "openfoodfacts",
        confidence: 1
      };

      if (item.nutriments.calories > 0) {
        results.push(item);
      }
    }
  }
  console.log(`✅ ${results.length} itens coletados de ${category}`);
  return results;
}

async function main() {
  let allItems = [];
  for (const cat of CATEGORIES) {
    const catItems = await fetchCategory(cat);
    allItems.push(...catItems);
  }

  console.log(`📊 Total antes de salvar: ${allItems.length} itens`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));
  console.log(`💾 Arquivo salvo: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("❌ Erro no script:", err);
});
