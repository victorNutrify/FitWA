"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getFirebaseClient } from "@/lib/firebase.client";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

const { auth, db } = getFirebaseClient();

// Parser para lista LLM (markdown ou texto simples) --> array para a tabela
function parseShoppingListToTable(text: string) {
  // Tenta parser como tabela markdown
  const lines = text
    .trim()
    .split("\n")
    .filter((line) => line.includes("|"));

  // Se tem cabeçalho de tabela markdown
  if (lines.length > 1 && lines[0].toLowerCase().includes("alimento")) {
    const headers = lines[0]
      .split("|")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    // Remove linhas separadoras tipo |----|
    const rows = lines
      .slice(1)
      .filter(line => !/^(\|\s*-+\s*)+\|?$/.test(line))
      .map((line) =>
        line
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
      )
      // Remove linhas que são duplicatas do header
      .filter((row) =>
        !(
          row.length === headers.length &&
          row[0]?.toLowerCase() === headers[0]?.toLowerCase() &&
          row[1]?.toLowerCase() === headers[1]?.toLowerCase()
        )
      );

    return { headers, rows };
  }

  // Se for lista simples: "Alimento: Quantidade" ou "Alimento    Quantidade"
  const simpleRows = text
    .trim()
    .split("\n")
    .map((line) => {
      if (line.toLowerCase().startsWith("alimento") && line.toLowerCase().includes("quantidade")) return null;
      if (line.includes(":")) {
        const [alimento, ...quantArr] = line.split(":");
        if (!alimento || quantArr.length === 0) return null;
        return [alimento.trim(), quantArr.join(":").trim()];
      } else if (line.match(/\t/)) {
        const [alimento, quantidade] = line.split(/\t+/);
        if (!alimento || !quantidade) return null;
        return [alimento.trim(), quantidade.trim()];
      } else if (line.match(/\s{2,}/)) {
        const [alimento, quantidade] = line.split(/\s{2,}/);
        if (!alimento || !quantidade) return null;
        return [alimento.trim(), quantidade.trim()];
      }
      return null;
    })
    .filter((row) => row && row.length === 2);

  if (simpleRows.length > 0) {
    return {
      headers: ["Alimento", "Quantidade"],
      rows: simpleRows,
    };
  }

  // Fallback: retorna null
  return null;
}

export default function ShoppingListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [shoppingList, setShoppingList] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function fetchShoppingList() {
      if (!user?.email) {
        setErrorMsg("Usuário não autenticado.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const listRef = doc(db, "chatfit", user.email, "listas", "listaCompras");
        const listSnap = await getDoc(listRef);
        if (listSnap.exists()) {
          const data = listSnap.data();
          setShoppingList(data.items || null);
        } else {
          setShoppingList(null);
        }
      } catch (err) {
        setErrorMsg("Erro ao buscar lista de compras.");
        setShoppingList(null);
      }
      setLoading(false);
    }
    fetchShoppingList();
  }, [user]);

  function handleGeneratePlan() {
    router.push("/dashboard/diet-plan-suggestion");
  }

  // Renderiza como tabela estilizada
  function renderShoppingList(list: string | null) {
    if (!list) return null;
    const parsedTable = parseShoppingListToTable(list);
    if (parsedTable) {
      return (
        <Table className="bg-white border rounded-xl overflow-hidden shadow-lg mt-2 w-full">
          <TableCaption className="mb-4 text-base text-muted-foreground text-left font-semibold">
            Lista de compras para 7 dias
          </TableCaption>
          <TableHeader>
            <TableRow>
              {parsedTable.headers.map((h, i) => (
                <TableHead
                  key={i}
                  className="font-bold text-base py-3 px-4 text-gray-800"
                  style={{ fontSize: "1rem" }}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedTable.rows.map((row, i) => (
              <TableRow key={i} style={{ fontSize: "1rem" }}>
                {row.map((c, j) => (
                  <TableCell
                    key={j}
                    className="py-3 px-4 text-[1rem] font-medium"
                    style={{
                      fontSize: "1rem",
                      color: "#333",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Fallback: texto simples
    return (
      <div className="mt-4 p-4 bg-muted rounded text-base whitespace-pre-line font-mono font-semibold">
        {list}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full flex gap-6">
      <div className="flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">Sua Lista de Compras Inteligente</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-center text-muted-foreground my-4">
                <Loader2 className="animate-spin h-6 w-6" />
                Carregando lista de compras...
              </div>
            ) : errorMsg ? (
              <div className="text-red-600 font-semibold text-base">{errorMsg}</div>
            ) : shoppingList ? (
              renderShoppingList(shoppingList)
            ) : (
              <div>
                <div className="mb-6 text-base font-medium">
                  Gere um plano de dieta para que possamos montar automaticamente sua lista de compras (7 dias).
                </div>
                <Button
                  size="lg"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-bold py-6 rounded-xl"
                  onClick={handleGeneratePlan}
                >
                  ✏️ Gerar plano de dieta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}