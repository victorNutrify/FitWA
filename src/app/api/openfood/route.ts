// src/app/api/openfood/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, doc, getDoc, setDoc } from "@/lib/firestore.admin.compat";
import { getFoodData } from "@/lib/openFoodFacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json(
        { ok: false, error: "Parâmetro obrigatório: q (nome do alimento)" },
        { status: 400 }
      );
    }

    const id = slugify(q);
    const ref = doc(db, "openfood", id);

    // 1) Tenta cache
    const snap = await getDoc(ref);
    if (snap.exists) {
      const cached = snap.data();
      return NextResponse.json(
        { ok: true, source: "cache", query: q, data: cached },
        { status: 200 }
      );
    }

    // 2) Busca "fresh" via lib consolidada
    const fresh = await getFoodData(q);

    // 3) Salva no cache (merge para permitir atualizações futuras)
    await setDoc(ref, { query: q, ...fresh, cachedAt: Date.now() }, { merge: true });

    return NextResponse.json(
      { ok: true, source: "fresh", query: q, data: fresh },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/openfood] Erro:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
