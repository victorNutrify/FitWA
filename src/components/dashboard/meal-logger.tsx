"use client";

import { useState, useRef, useEffect } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ScanBarcode, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseClient } from "@/lib/firebase.client";
const { auth, db } = getFirebaseClient();
import {
  doc, getDoc, setDoc, collection, getDocs,
  deleteDoc, orderBy, query
} from "firebase/firestore";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  data?: any;
  alimentos?: any[];
  createdAt?: any;
  step?: "image_review" | "image_confirm" | undefined;
};

type MealLoggerProps = {
  onMealLogged?: () => void;
};

function getDiaAtual() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().slice(0, 10);
}

const nomesInvalidos = [
  "totais", "totais aproximados", "calorias",
  "proteína", "proteina", "carboidratos",
  "carboidrato", "gordura"
];

function alimentoValido(alimento: any) {
  if (!alimento || !alimento.nome) return false;
  const nomeNorm = (alimento.nome || "").trim().toLowerCase();
  if (nomesInvalidos.some(inv => nomeNorm.includes(inv))) return false;

  return (
    (alimento.calorias ?? 0) > 0 ||
    (alimento.proteina ?? 0) > 0 ||
    (alimento.carboidrato ?? 0) > 0 ||
    (alimento.gordura ?? 0) > 0
  );
}

function normalizarNome(nome: string) {
  if (!nome) return "";
  let txt = nome.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\s|_|-)+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
  txt = txt.replace(/\bovos\b/g, "ovo").replace(/\bbananas\b/g, "banana");
  return txt;
}

function getDisplayContent(msg: ChatMessage): string {
  if (msg.role === "assistant" && msg.data?.reply) return msg.data.reply;
  return msg.content;
}

function getHoraMinuto(ts: any): string {
  if (!ts) return "";
  let dateObj: Date;
  if (typeof ts === "string") dateObj = new Date(ts);
  else if (ts instanceof Date) dateObj = ts;
  else if (ts?.seconds) dateObj = new Date(ts.seconds * 1000);
  else return "";
  return dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getTipoRefeicao(ts: any): string {
  let dateObj: Date;
  if (!ts) return "Indefinido";
  if (typeof ts === "string") dateObj = new Date(ts);
  else if (ts instanceof Date) dateObj = ts;
  else if (ts?.seconds) dateObj = new Date(ts.seconds * 1000);
  else return "Indefinido";

  const totalMin = dateObj.getHours() * 60 + dateObj.getMinutes();
  if (totalMin >= 240 && totalMin <= 600) return "Café da manhã";
  if (totalMin > 600 && totalMin <= 720) return "Lanche da manhã";
  if (totalMin > 720 && totalMin <= 900) return "Almoço";
  if (totalMin > 900 && totalMin <= 1140) return "Lanche da tarde";
  if (totalMin > 1140 && totalMin <= 1320) return "Jantar";
  if ((totalMin > 1320 && totalMin <= 1440) || (totalMin >= 0 && totalMin < 240)) return "Ceia";
  return "Indefinido";
}

function getAlimentosPorRefeicaoOrdenado(alimentos: any[]) {
  const grupos: { [key: string]: any[] } = {};
  for (const alimento of alimentos) {
    let horario = alimento.horario;
    if (horario?.seconds) horario = new Date(horario.seconds * 1000);
    else if (typeof horario === "string") horario = new Date(horario);
    const tipo = getTipoRefeicao(horario);
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push({ ...alimento, _horario: horario });
  }
  for (const grupo in grupos) {
    grupos[grupo] = grupos[grupo].sort((a, b) => (b._horario as any) - (a._horario as any));
  }
  return Object.entries(grupos)
    .map(([tipo, alimentos]) => ({
      tipo,
      alimentos,
      ultimoHorario: (alimentos as any[])[0]?._horario || new Date(0),
      resumo: (alimentos as any[]).reduce(
        (acc: any, a: any) => ({
          calorias: acc.calorias + (a.calorias ?? 0),
          proteina: acc.proteina + (a.proteina ?? 0),
          carboidrato: acc.carboidrato + (a.carboidrato ?? 0),
          gordura: acc.gordura + (a.gordura ?? 0),
        }),
        { calorias: 0, proteina: 0, carboidrato: 0, gordura: 0 }
      ),
    }))
    .sort((a: any, b: any) => (b.ultimoHorario as any) - (a.ultimoHorario as any));
}

async function getIdToken() {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken(true);
}

export default function MealLogger({ onMealLogged }: MealLoggerProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [alimentosHoje, setAlimentosHoje] = useState<any[]>([]);
  const [exerciciosHoje, setExerciciosHoje] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [pendingAlimentos, setPendingAlimentos] = useState<any[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ alimento?: any, exercicio?: any } | null>(null);

  useEffect(() => {
    async function fetchAlimentosHoje() {
      if (!user?.email) return;
      const dia = getDiaAtual();
      const alimentosRef = collection(db, "chatfit", user.email, "refeicoes", dia, "historicoAlimentos");
      const q = query(alimentosRef, orderBy("horario", "desc"));
      const snap = await getDocs(q);
      const alimentos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(alimentoValido);
      setAlimentosHoje(alimentos as any[]);
    }
    fetchAlimentosHoje();
  }, [user, loading]);

 useEffect(() => {
  async function fetchExerciciosHoje() {
    if (!user?.email) return;
    const dia = getDiaAtual();
    const exercicioDocRef = doc(db, "chatfit", user.email, "exerciciosDoDia", dia);
    const exercicioDocSnap = await getDoc(exercicioDocRef);

    if (!exercicioDocSnap.exists()) {
      setExerciciosHoje([]);
      return;
    }

    const data = exercicioDocSnap.data() || {};
    const exercicios = Array.isArray(data.exercicios) ? data.exercicios : [];
    setExerciciosHoje(exercicios);
  }
  fetchExerciciosHoje();
}, [user, loading]);

  useEffect(() => {
    if (chatContainerRef.current && messagesEndRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  function fmt(val: any): string {
    if (val == null || isNaN(val)) return "";
    return Number(val).toFixed(1);
  }

  async function confirmarExcluirAlimento(alimento: any) {
    if (!user?.email || !alimento?.id) return;
    setLoading(true);
    try {
      const dia = getDiaAtual();
      const alimentoRef = doc(db, "chatfit", user.email, "refeicoes", dia, "historicoAlimentos", alimento.id);
      await deleteDoc(alimentoRef);
      setAlimentosHoje(prev => prev.filter(a => a.id !== alimento.id));
      onMealLogged?.();
    } catch {
      setError("Erro ao excluir alimento.");
    }
    setLoading(false);
    setConfirmDelete(null);
  }

  async function confirmarExcluirExercicio(exercicio: any) {
    if (!user?.email) return;
    setLoading(true);
    try {
      const dia = getDiaAtual();
      const exercicioDocRef = doc(db, "chatfit", user.email, "exerciciosDoDia", dia);
      const exercicioDocSnap = await getDoc(exercicioDocRef);
      if (!exercicioDocSnap.exists) return;
      let exerciciosBanco: any[] = Array.isArray(exercicioDocSnap.data().exercicios) ? [...exercicioDocSnap.data().exercicios] : [];
      exerciciosBanco = exerciciosBanco.filter(e => !(e.tipo === exercicio.tipo && e.duracao === exercicio.duracao));
      await setDoc(exercicioDocRef, { exercicios: exerciciosBanco }, { merge: true });
      setExerciciosHoje(exerciciosBanco);
      onMealLogged?.();
    } catch {
      setError("Erro ao excluir exercício.");
    }
    setLoading(false);
    setConfirmDelete(null);
  }

async function handleSend(e?: React.FormEvent | KeyboardEvent) {
  if (e) e.preventDefault();
  if (loading || !input.trim()) return;

  setLoading(true);
  setError("");
  setMessages(msgs => [...msgs, { role: "user", content: input }]);

  try {
    const token = await getIdToken();
    if (!token) throw new Error("Token ausente, faça login novamente.");

    const openAIMessages = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      .concat([{ role: "user", content: input }]);

    const res = await fetch("/api/register-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: openAIMessages,
        userEmail: user?.email || null,   // 🔥 agora o backend sabe quem salvar
      }),
    });

    const data = await res.json();
    setMessages(msgs => [...msgs, { role: "assistant", content: data.reply || "OK", data }]);
  } catch {
    setError("Erro ao conectar com a IA.");
  }
  setInput("");
  setLoading(false);
}

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    setError("Imagem muito grande (máx. 5MB).");
    return;
  }

  const reader = new FileReader();
  reader.onloadend = async () => {
    const imageBase64 = reader.result as string;
    setSelectedImage(imageBase64);
    setSelectedImageName(file.name);
    setLoading(true);

    setMessages(msgs => [...msgs, { role: "user", content: "[Imagem enviada]", imageBase64 }]);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Token ausente, faça login novamente.");

      const openAIMessages = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        .concat([{ role: "user", content: "[Imagem enviada]" }]);

      const res = await fetch("/api/register-chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: openAIMessages,
          imageBase64,
          userEmail: user?.email || null,   // 🔥 também envia no upload
        }),
      });

      const data = await res.json();
      setMessages(msgs => [...msgs, { role: "assistant", content: data.reply || "OK", data }]);
    } catch {
      setError("Erro ao conectar com a IA.");
    }
    setLoading(false);
  };
  reader.readAsDataURL(file);
}

  const refeicoesOrdenadas = getAlimentosPorRefeicaoOrdenado(alimentosHoje);
  const compactItemClass =
    "flex items-center gap-2 px-1 py-1 rounded hover:bg-secondary transition-all border-b border-border min-h-[32px]";
  const compactTitleClass = "font-semibold text-[1em] text-foreground truncate";
  const compactInfoClass = "text-xs text-muted-foreground mt-0.5 truncate";
  const compactButtonClass =
    "ml-2 bg-destructive text-destructive-foreground rounded p-1 hover:bg-destructive/80 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Falar com IA</CardTitle>
          <CardDescription>
            Envie texto ou uma imagem da sua refeição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Chat */}
          <div
            ref={chatContainerRef}
            className="mb-4 max-h-[320px] overflow-y-auto border rounded p-2 bg-muted/30"
            style={{ position: "relative" }}
          >
            {messages.length === 0 && (
              <div className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`mb-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-lg px-3 py-2 max-w-[70%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border text-foreground"
                  }`}
                >
                  {msg.imageBase64 ? (
                    <img src={msg.imageBase64} alt="Imagem enviada" className="max-w-full max-h-32 rounded mb-2" />
                  ) : null}
                  {getDisplayContent(msg)}
                  {msg.step === "image_review" && msg.alimentos && (
                    <div className="mt-2">
                      <div className="font-semibold mb-1 text-yellow-700">Alimentos detectados:</div>
                      {msg.alimentos.map((a, i) => (
                        <div key={i} className="text-xs mb-1 bg-yellow-50 rounded px-2 py-1">
                          <span className="font-semibold">{a.nome}</span>
                          {a.quantidade ? ` - ${a.quantidade}` : ""}
                          {a.calorias ? `, ${fmt(a.calorias)} kcal` : ""}
                          {a.proteina ? `, ${fmt(a.proteina)}g proteína` : ""}
                          {a.carboidrato ? `, ${fmt(a.carboidrato)}g carbo` : ""}
                          {a.gordura ? `, ${fmt(a.gordura)}g gordura` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            {loading && (
              <div className="mb-2 flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-background border text-muted-foreground">
                  IA está respondendo...
                </div>
              </div>
            )}
          </div>

          {error && error !== "" && error !== "Erro ao conectar com a IA." && (
            <div className="mb-2 text-sm text-destructive">{error}</div>
          )}

          <form onSubmit={handleSend}>
            <div className="relative">
              <Textarea
                placeholder={
                  pendingAlimentos
                    ? "Digite 'confirmar' para lançar esses alimentos, ou envie uma correção antes de confirmar."
                    : "Digite sua mensagem para a IA..."
                }
                className="pr-24"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Enviar mensagem</span>
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {selectedImage && (
                <div className="flex items-center gap-2 mb-2">
                  <img src={selectedImage} alt="Preview" className="max-h-20 rounded border" />
                  <span className="text-sm text-muted-foreground">{selectedImageName}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (!loading) fileInputRef.current?.click();
                  }}
                  disabled={loading}
                  type="button"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {selectedImageName ? selectedImageName : "Enviar Foto"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled
                  type="button"
                >
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Escanear Código de Barras
                </Button>
              </div>
            </div>
          </form>

          {/* Exercícios físicos lançados hoje */}
          <div className="mt-8">
            <div
              className="mb-2"
              style={{
                fontWeight: 700,
                fontSize: "1.3em",
                color: "#FFD700",
                letterSpacing: "0.02em"
              }}
            >
              Exercícios físicos lançados hoje:
            </div>
            {exerciciosHoje.length === 0 && (
              <div className="text-muted-foreground text-sm">Nenhum exercício lançado hoje.</div>
            )}
            <div className="flex flex-col gap-2">
              {exerciciosHoje.map((exercicio, idx) => (
                <div key={idx} className={compactItemClass}>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={compactTitleClass}>
                      {exercicio.tipo}
                      {exercicio.duracao ? <span className="font-normal text-muted-foreground ml-2">{exercicio.duracao}</span> : null}
                      {exercicio.calorias ? <span className="font-normal text-muted-foreground ml-1">{fmt(exercicio.calorias)} kcal</span> : null}
                    </span>
                    <span className={compactInfoClass}>
                      {getHoraMinuto(exercicio.horario)}
                    </span>
                  </div>
                  <button
                    className={compactButtonClass}
                    aria-label="Deletar exercício"
                    onClick={() => pedirConfirmacaoExercicio(exercicio)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alimentos lançados hoje */}
          <div className="mt-8">
            <div
              className="mb-2"
              style={{
                fontWeight: 700,
                fontSize: "1.3em",
                color: "#FFD700",
                letterSpacing: "0.02em"
              }}
            >
              Alimentos lançados hoje:
            </div>
            {alimentosHoje.length === 0 && (
              <div className="text-muted-foreground text-sm">Nenhum alimento lançado hoje.</div>
            )}
            <div className="flex flex-col gap-2">
              {refeicoesOrdenadas.map(refeicao => (
                refeicao.alimentos.length > 0 ? (
                  <div key={refeicao.tipo} className="border-2 border-muted rounded mb-2">
                    <div
                      className="px-2 py-1 font-medium text-[1em] flex items-center justify-between"
                      style={{ color: "#cd7f32", fontWeight: 700, letterSpacing: "0.02em" }}
                    >
                      <span>{refeicao.tipo}</span>
                      <span className="text-base font-semibold text-foreground ml-2">
                        {fmt(refeicao.resumo.calorias)} kcal
                        {refeicao.resumo.proteina ? `, ${fmt(refeicao.resumo.proteina)}g proteína` : ""}
                        {refeicao.resumo.carboidrato ? `, ${fmt(refeicao.resumo.carboidrato)}g carbo` : ""}
                        {refeicao.resumo.gordura ? `, ${fmt(refeicao.resumo.gordura)}g gordura` : ""}
                      </span>
                    </div>
                    <div>
                      {refeicao.alimentos.map((alimento: any) => (
                        <div
                          key={alimento.id}
                          className={compactItemClass}
                        >
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={compactTitleClass}>
                              {alimento.nome ?? "Alimento"}
                              {alimento.quantidade ? (
                                <span className="font-normal text-muted-foreground ml-2">{alimento.quantidade}</span>
                              ) : null}
                            </span>
                            <span className={compactInfoClass}>
                              {alimento.calorias ? `${fmt(alimento.calorias)} kcal` : ""}
                              {alimento.proteina ? `, ${fmt(alimento.proteina)}g proteína` : ""}
                              {alimento.carboidrato ? `, ${fmt(alimento.carboidrato)}g carbo` : ""}
                              {alimento.gordura ? `, ${fmt(alimento.gordura)}g gordura` : ""}
                            </span>
                          </div>
                          <div className="ml-auto font-medium text-xs text-muted-foreground min-w-[56px] text-right">
                            {getHoraMinuto(alimento.horario)}
                          </div>
                          <button
                            className={compactButtonClass}
                            aria-label="Deletar alimento"
                            onClick={() => pedirConfirmacaoAlimento(alimento)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.alimento
                ? `Tem certeza que deseja deletar ${confirmDelete.alimento.quantidade ?? ""} de ${confirmDelete.alimento.nome ?? ""}?`
                : confirmDelete?.exercicio
                  ? `Tem certeza que deseja deletar ${confirmDelete.exercicio.duracao ?? ""} de ${confirmDelete.exercicio.tipo ?? ""}?`
                  : ""
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              Lembre-se que você pode substituir ou editar os itens usando nossa IA antes de deletá-los.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete?.alimento) confirmarExcluirAlimento(confirmDelete.alimento);
                if (confirmDelete?.exercicio) confirmarExcluirExercicio(confirmDelete.exercicio);
              }}
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
