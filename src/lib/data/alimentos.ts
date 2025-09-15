// src/lib/data/alimentos.ts
import fs from "fs";
import path from "path";

export type AlimentoBR = {
  name?: string;
  nome?: string;
  category?: string;
  nutriments?: {
    calories?: number | string;
    protein_g?: number | string;
    carbs_g?: number | string;
    fat_g?: number | string;
  };
  portion_grams?: number;
};

let alimentosBr: AlimentoBR[] = [];

try {
  const jsonPath = path.resolve(process.cwd(), "alimentos_br.json");
  const jsonContent = fs.readFileSync(jsonPath, "utf-8");
  alimentosBr = JSON.parse(jsonContent) as AlimentoBR[];
  console.log("alimentos_br.json carregado com", alimentosBr.length, "alimentos.");
} catch (e) {
  alimentosBr = [];
  console.error("Erro ao carregar alimentos_br.json:", e);
}

export default alimentosBr;
