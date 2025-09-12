// src/lib/foodsResolver.ts
// Resolver unificado para alimentos
// Fluxo: Firestore cache -> JSON local -> openFoodFacts -> notfound

import { db } from "@/lib/firebase"; 
import { doc, getDoc, setDoc } from "firebase/firestore";
import alimentos from "@/data/alimentos_br.json";
import { getFoodData as getFromOFF } from "./openFoodFacts"; 
import { normalizeFoodName } from "./stringUtils";

// Tipo base
export type FoodData = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
};

// Busca no JSON local (rápido e offline)
function localFoodLookup(name: string): FoodData | null {
  const norm = normalizeFoodName(name);
  const aliHit = alimentos.find(f => normalizeFoodName(f.name) === norm);

  if (aliHit) {
    return {
      name: aliHit.name,
      calories: aliHit.nutriments?.calories || 0,
      protein: aliHit.nutriments?.protein_g || 0,
      carbs: aliHit.nutriments?.carbs_g || 0,
      fat: aliHit.nutriments?.fat_g || 0,
      source: "local-json"
    };
  }
  return null;
}

// Função principal
export async function getFoodData(foodName: string): Promise<FoodData> {
  const norm = normalizeFoodName(foodName);

  // 1) Firestore cache
  try {
    const ref = doc(db, "foods_cache", norm);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as FoodData;
    }
  } catch (e) {
    console.warn("[foodsResolver] Falha ao ler cache:", e);
  }

  // 2) JSON local
  const local = localFoodLookup(foodName);
  if (local) return local;

  // 3) Delegar para openFoodFacts.ts (já faz manual + OFF)
  const resolved = await getFromOFF(foodName);
  if (resolved && resolved.source !== "notfound") {
    // Cache no Firestore
    try {
      const ref = doc(db, "foods_cache", norm);
      await setDoc(ref, resolved, { merge: true });
    } catch (e) {
      console.warn("[foodsResolver] Falha ao salvar cache:", e);
    }
    return resolved;
  }

  // 4) Fallback final
  return {
    name: foodName,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    source: "notfound"
  };
}
