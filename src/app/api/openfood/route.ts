import fetch from "node-fetch";
import { db, doc, setDoc, getDocs, collection, runTransaction, deleteDoc } from "@/lib/firestore.admin.compat";

type FoodData = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
};

// Busca alimento no cache do Firestore
export async function getFoodFromCache(foodName: string): Promise<FoodData | null> {
  const ref = doc(db, "foodcache", foodName.toLowerCase());
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as FoodData;
  return null;
}

// Salva alimento no cache
export async function saveFoodToCache(foodName: string, data: FoodData) {
  const ref = doc(db, "foodcache", foodName.toLowerCase());
  await setDoc(ref, data, { merge: true });
}

// Busca alimento na API do Open Food Facts
export async function getFoodFromOpenFoodFacts(foodName: string): Promise<FoodData | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}&search_simple=1&action=process&json=1&page_size=1`;
  const res = await fetch(url);
  const json = await res.json();
  const product = json.products?.[0];
  if (!product) return null;
  return {
    name: product.product_name || foodName,
    calories: Number(product.nutriments?.energy_kcal_100g ?? 0),
    protein: Number(product.nutriments?.proteins_100g ?? 0),
    carbs: Number(product.nutriments?.carbohydrates_100g ?? 0),
    fat: Number(product.nutriments?.fat_100g ?? 0),
    source: "openfoodfacts"
  };
}

// Função principal para buscar alimento (cache + API)
export async function getFoodData(foodName: string): Promise<FoodData | null> {
  // 1. Buscar no cache
  let cached = await getFoodFromCache(foodName);
  if (cached) return cached;

  // 2. Buscar na API externa
  let openFood = await getFoodFromOpenFoodFacts(foodName);
  if (openFood) {
    await saveFoodToCache(foodName, openFood);
    return openFood;
  }
  return null;
}