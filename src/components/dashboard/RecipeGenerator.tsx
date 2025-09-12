"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

// Cor bronze: #CD7F32
const bronzeColor = "#CD7F32";

interface Macros {
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
}

interface RecipeData {
  name: string;
  ingredients: string[];
  preparation: string[];
  macros: Macros;
  sourceName: string;
  sourceUrl: string;
}

function parseRecipeMarkdown(markdown: string): RecipeData | null {
  // Remove blocos markdown
  const clean = markdown.replace(/```markdown|```/g, "");
  const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);

  let name = "";
  const ingredients: string[] = [];
  const preparation: string[] = [];
  const macros: Macros = {};
  let sourceName = "";
  let sourceUrl = "";

  let section = "";

  for (const line of lines) {
    if (!name && line && !line.startsWith("-") && !line.startsWith("##") && !line.toLowerCase().includes("ingredientes") && !line.toLowerCase().includes("modo de preparo") && !line.toLowerCase().includes("macros")) {
      name = line.replace(/^#/, "").replace(/^Nome da Receita:/i, "").trim();
      continue;
    }
    if (line.toLowerCase().includes("ingredientes")) {
      section = "ingredients";
      continue;
    }
    if (line.toLowerCase().includes("modo de preparo")) {
      section = "preparation";
      continue;
    }
    if (line.toLowerCase().includes("macros")) {
      section = "macros";
      continue;
    }
    if (line.toLowerCase().includes("fonte")) {
      section = "source";
      continue;
    }

    if (section === "ingredients" && line) {
      ingredients.push(line.replace(/^-/, "").trim());
    } else if (section === "preparation" && line) {
      preparation.push(line.replace(/^\d+\.\s*/, "").trim());
    } else if (section === "macros" && line.includes(":")) {
      if (line.toLowerCase().includes("calorias")) macros.calories = line.split(":")[1].replace("kcal", "").trim();
      if (line.toLowerCase().includes("proteína")) macros.protein = line.split(":")[1].replace("g", "").trim();
      if (line.toLowerCase().includes("carboidrato")) macros.carbs = line.split(":")[1].replace("g", "").trim();
      if (line.toLowerCase().includes("gordura")) macros.fat = line.split(":")[1].replace("g", "").trim();
    } else if (section === "source" && line.match(/\[(.+)\]\((.+)\)/)) {
      const match = line.match(/\[(.+)\]\((.+)\)/);
      if (match) {
        sourceName = match[1];
        sourceUrl = match[2];
      }
    }
  }

  if (!name) name = "Receita Sugerida";

  return {
    name,
    ingredients,
    preparation,
    macros,
    sourceName,
    sourceUrl,
  };
}

export function RecipeGenerator() {
  const [ingredients, setIngredients] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipeData, setRecipeData] = useState<RecipeData | null>(null);

  async function handleGenerateRecipe() {
    setLoading(true);
    setError(null);
    setRecipeData(null);

    try {
      const userMessage = {
        role: "user",
        content: `Ingredientes disponíveis: ${ingredients}`,
      };

      const res = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [userMessage],
          userEmail: "",
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        const parsed = parseRecipeMarkdown(data.reply || "");
        if (parsed) {
          setRecipeData(parsed);
        } else {
          setError("Não foi possível interpretar a receita retornada.");
        }
      }
    } catch (err: any) {
      setError("Erro ao gerar receita. Tente novamente.");
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="grid gap-2">
        <Label htmlFor="ingredients">
          Quais ingredientes você tem disponíveis?
        </Label>
        <Textarea
          id="ingredients"
          value={ingredients}
          onChange={e => setIngredients(e.target.value)}
          placeholder="Ex: 2 ovos, 1 tomate, queijo, ..."
          className="min-h-[100px]"
          disabled={loading}
        />
      </div>
      <Button className="mt-4 w-full" onClick={handleGenerateRecipe} disabled={loading || !ingredients.trim()}>
        {loading ? "Gerando..." : "Gerar Receita"}
      </Button>

      <div className="mt-8">
        <Card className="mt-2">
          <CardContent className="p-6" style={{ maxWidth: "100%", overflowX: "hidden" }}>
            {error ? (
              <p className="text-red-600">{error}</p>
            ) : recipeData ? (
              <div className="flex flex-col gap-4">
                {/* Nome da receita */}
                <div className="flex flex-row items-center justify-between mb-2">
                  <span className="text-2xl font-bold" style={{ color: bronzeColor }}>{recipeData.name}</span>
                  {recipeData.sourceUrl && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 transition-all">
                      <a href={recipeData.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {recipeData.sourceName || "Fonte"}
                      </a>
                    </Badge>
                  )}
                </div>
                {/* Ingredientes */}
                <div>
                  <span className="font-semibold text-base" style={{ color: bronzeColor }}>Ingredientes</span>
                  <ul className="mt-2 mb-2 list-disc ml-5 text-black">
                    {recipeData.ingredients.map((ing, idx) => (
                      <li key={idx}>{ing}</li>
                    ))}
                  </ul>
                </div>
                <Separator />
                {/* Modo de preparo */}
                <div>
                  <span className="font-semibold text-base" style={{ color: bronzeColor }}>Modo de Preparo</span>
                  <ol className="mt-2 mb-2 list-decimal ml-5 text-black">
                    {recipeData.preparation.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
                <Separator />
                {/* Macros */}
                <div>
                  <span className="font-semibold text-base" style={{ color: bronzeColor }}>Macros da receita</span>
                  <div className="mt-2 mb-2 flex gap-5 text-black">
                    <Badge className="bg-purple-100 text-black">{`Calorias: ${recipeData.macros.calories || "Erro ao calcular"} kcal`}</Badge>
                    <Badge className="bg-purple-100 text-black">{`Proteína: ${recipeData.macros.protein || "Erro ao calcular"}g`}</Badge>
                    <Badge className="bg-purple-100 text-black">{`Carboidrato: ${recipeData.macros.carbs || "Erro ao calcular"}g`}</Badge>
                    <Badge className="bg-purple-100 text-black">{`Gordura: ${recipeData.macros.fat || "Erro ao calcular"}g`}</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                A receita gerada pela IA aparecerá aqui.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}