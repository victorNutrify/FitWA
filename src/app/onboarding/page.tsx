"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Carousel, CarouselContent, CarouselItem, type CarouselApi,
} from "@/components/ui/carousel";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AppLogo } from "@/components/app-logo";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { saveUserMeta } from "@/lib/firebase.client";
import { getFirebaseClient } from "@/lib/firebase.client";
const { auth, db } = getFirebaseClient();
import {
  doc, setDoc, getDocs, query, where, limit, collection,
} from "firebase/firestore";

// ---------------- SCHEMA ----------------
const onboardingSchema = z.object({
  age: z.coerce.number().min(14, "A idade deve ser no mínimo 14 anos."),
  weight: z.coerce.number().min(30, "O peso deve ser no mínimo 30 kg."),
  height: z
    .coerce.number()
    .min(110, "Use centímetros para a altura (ex: para 1,75m, digite 175).")
    .int("Use um número inteiro para centímetros (ex: 175)."),
  gender: z.enum(["male", "female"], {
    required_error: "Por favor, selecione seu gênero.",
  }),
  goal: z.enum(["lose", "maintain", "gain"], {
    required_error: "Por favor, selecione seu objetivo.",
  }),
  fullName: z.string().min(2, "O nome completo é obrigatório."),
  email: z.string().email("Por favor, insira um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  phone: z.string().default(""),
  consent: z.boolean().default(false),
  preferencias: z.string().max(1000, "Máximo de 1000 caracteres.").default(""),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [progress, setProgress] = React.useState(25); // 4 passos
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null); // erro pequeno
  const [topError, setTopError] = React.useState<string>("");    // ERRO GRANDE no último passo
  const [loading, setLoading] = React.useState(false);           // desabilitar botões
  const [loadingStep, setLoadingStep] = React.useState<number>(0);
  const [showLoadingSteps, setShowLoadingSteps] = React.useState(false); // overlay só para plano/lista
  const [desiredSlide, setDesiredSlide] = React.useState<number | null>(null); // força ficar no slide 3 quando erro
  const carouselWrapperRef = React.useRef<HTMLDivElement | null>(null);

  const { signup } = useAuth();
  const router = useRouter();

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      age: 30,
      weight: 70,
      height: 175,
      gender: "male",
      goal: "lose",
      fullName: "",
      email: "",
      password: "",
      phone: "",
      consent: false,
      preferencias: "",
    },
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!api) return;
    const updateState = () => {
      setCurrent(api.selectedScrollSnap());
      setProgress(((api.selectedScrollSnap() + 1) / 4) * 100);
    };
    updateState();
    api.on("select", updateState);
    return () => { api.off("select", updateState); };
  }, [api]);

  // Se em algum momento precisarmos forçar o slide (ex.: erro no último passo), fazemos aqui
  React.useEffect(() => {
    if (api && desiredSlide !== null) {
      api.scrollTo(desiredSlide);
      setDesiredSlide(null);
    }
  }, [api, desiredSlide]);

  // ---------------- HELPERS ----------------
  const normalizePhone = (phone: string) => (phone || "").replace(/\D/g, "");

  // Checa duplicidade de telefone em chatfit/{email} (doc raiz com campo "telefone")
  async function telefoneJaExiste(phone: string): Promise<boolean> {
    const norm = normalizePhone(phone || "");
    if (!norm) return false;
    try {
      const snap = await getDocs(
        query(collection(db, "chatfit"), where("telefone", "==", norm), limit(1))
      );
      if (snap.size > 0) return true;
      // fallback se alguém salvou com formatação original
      const snapRaw = await getDocs(
        query(collection(db, "chatfit"), where("telefone", "==", phone), limit(1))
      );
      return snapRaw.size > 0;
    } catch {
      // Em caso de erro de permissão/rede, não bloqueia cadastro
      return false;
    }
  }

  // ---------------- CÁLCULO DE METAS (sem nível de atividade) ----------------
  function calcularMetaMacros({
    age, weight, height, gender, goal,
  }: Pick<OnboardingValues, "age" | "weight" | "height" | "gender" | "goal">) {
    // TMB (Mifflin-St Jeor)
    let tmb =
      gender === "male"
        ? 88.36 + 13.4 * weight + 4.8 * height - 5.7 * age
        : 447.6 + 9.2 * weight + 3.1 * height - 4.3 * age;

    // Sem multiplicador de atividade — exercícios somados depois
    let calorias = tmb;
    if (goal === "lose") calorias -= 500;
    if (goal === "gain") calorias += 500;
    calorias = Math.max(calorias, 1200);
    calorias = Math.round(calorias);

    // Macros (2g/kg proteína, 1g/kg gordura, carbo = resto, mínimo 0)
    const proteina = Math.round(weight * 2);
    const gordura = Math.round(weight * 1);
    const caloriasProteina = proteina * 4;
    const caloriasGordura = gordura * 9;
    const carboidrato = Math.max(
      0,
      Math.round((calorias - caloriasProteina - caloriasGordura) / 4)
    );

    return { caloriasMeta: calorias, proteina, carboidrato, gordura };
  }

  // ---------------- META DE ÁGUA (ml) ----------------
  function calcularMetaAgua({ weight }: Pick<OnboardingValues, "weight">) {
    // 35 ml/kg com limites 1500–6000 ml
    const ml = Math.round(weight * 35);
    return Math.min(6000, Math.max(1500, ml));
  }

  // ---------------- LOADING MESSAGES ----------------
  const loadingMessages = [
    "Criando seu plano de dieta...",
    "Mais um momento...",
    "Criando sua lista de supermercado com base em sua dieta...",
    "Mais alguns segundos...",
  ];

  // ---------------- GERAÇÃO DE PLANO (chama /api/generate-diet-plan) ----------------
  async function gerarPlanoDietaLLM({
    caloriasMeta, proteina, carboidrato, gordura, preferencias, email,
  }: {
    caloriasMeta: number; proteina: number; carboidrato: number; gordura: number; preferencias: string; email: string;
  }) {
    try {
      setLoadingStep(0);
      setShowLoadingSteps(true);

      const messages = [{ role: "user", content: preferencias || "Nenhuma restrição específica." }];

      setLoadingStep(0);
      await new Promise((r) => setTimeout(r, 700));

      const response = await fetch("/api/generate-diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, userEmail: email }),
      });

      setLoadingStep(1);
      await new Promise((r) => setTimeout(r, 700));

      const data = await response.json();

      if (data.reply) {
        const dietPlanRef = doc(db, "chatfit", email, "planos", "dieta");
        await setDoc(
          dietPlanRef,
          { content: data.reply, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }

      setLoadingStep(2);
      await new Promise((r) => setTimeout(r, 700));

      if (Array.isArray(data.shoppingList) && data.shoppingList.length > 0) {
        const listaRef = doc(db, "chatfit", email, "listas", "lista_padrao");
        await setDoc(
          listaRef,
          { criadoEm: new Date().toISOString(), alimentos: data.shoppingList },
          { merge: true }
        );
      }

      setLoadingStep(3);
      await new Promise((r) => setTimeout(r, 700));
      setShowLoadingSteps(false);
    } catch (err) {
      setShowLoadingSteps(false);
      console.error("Falha ao gerar plano alimentar LLM:", err);
    }
  }

  // ---------------- SUBMIT ----------------
  async function onSubmit(data: OnboardingValues) {
    setSubmitted(true);
    setError(null);
    setTopError("");
    setLoading(true);            // desabilita botões
    setShowLoadingSteps(false);  // overlay só quando gerar plano

    try {
      // 1) Checar telefone duplicado ANTES do signup (em chatfit/{email} docs)
      const phoneExists = data.phone ? await telefoneJaExiste(data.phone) : false;
      if (phoneExists) {
        const msg = "Telefone já cadastrado. Faça login ou use outro número.";
        setTopError(msg);
        form.setError("phone", { type: "manual", message: msg });
        setLoading(false);
        setDesiredSlide(3); // mantém no último carrossel
        return;
      }

      // 2) Prossegue com cadastro (Auth) — se e-mail já existir, o Firebase lança erro e tratamos no catch
      const userData = {
        nome: data.fullName,
        telefone: normalizePhone(data.phone || ""),
        consent: data.consent,
        email: data.email,
        preferencias: data.preferencias,
      };
      await signup(data.email, data.password, userData);

      // 3) Garante doc raiz em chatfit/{email} (merge) com telefone normalizado
      await setDoc(
        doc(db, "chatfit", data.email),
        {
          nome: data.fullName,
          email: data.email,
          telefone: normalizePhone(data.phone || ""),
          consent: data.consent,
          preferencias: data.preferencias,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 4) Calcula metas
      const macros = calcularMetaMacros({
        age: data.age,
        weight: data.weight,
        height: data.height,
        gender: data.gender,
        goal: data.goal,
      });
      const waterGoalMl = calcularMetaAgua({ weight: data.weight });

      // 5) Salva metas (subcoleção metasusuario)
      await saveUserMeta(data.email, {
        nome: data.fullName,
        telefone: normalizePhone(data.phone || ""),
        age: data.age,
        weight: data.weight,
        height: data.height,
        gender: data.gender,
        goal: data.goal,
        preferencias: data.preferencias,
        waterGoalMl,
        ...macros,
      });

      // 6) Plano + lista (aqui sim mostramos overlay step-by-step)
      await gerarPlanoDietaLLM({
        caloriasMeta: macros.caloriasMeta,
        proteina: macros.proteina,
        carboidrato: macros.carboidrato,
        gordura: macros.gordura,
        preferencias: data.preferencias,
        email: data.email,
      });

      setLoading(false);
      router.push("/dashboard");
    } catch (err: any) {
      setLoading(false);
      setShowLoadingSteps(false);

      // Trata Firebase Auth: e-mail já existe
      if (err?.code === "auth/email-already-in-use" || String(err?.message || "").includes("EMAIL_EXISTS")) {
        const msg = "E-mail já cadastrado. Faça login ou use outro e-mail.";
        setTopError(msg);
        form.setError("email", { type: "manual", message: msg });
        setDesiredSlide(3);
        return;
      }

      // Erro genérico
      const msg = err?.message || "Erro ao cadastrar usuário.";
      setTopError(msg);
      setError(msg);
      setDesiredSlide(3);
    }
  }

  // ---------------- INPUT HELPERS ----------------
  const handleNumberChange = (field: any, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) field.onChange(num);
    if (value === "") field.onChange(undefined);
  };

  // Altura: remove vírgula/ponto automaticamente e mantém apenas dígitos (cm)
  const handleHeightChange = (field: any, raw: string) => {
    const sanitized = raw.replace(/[.,]/g, ""); // remove vírgula e ponto
    const onlyDigits = sanitized.replace(/[^\d]/g, "");
    if (onlyDigits === "") {
      field.onChange(undefined);
      return;
    }
    const num = parseInt(onlyDigits, 10);
    if (!isNaN(num)) field.onChange(num);
  };

  const nextStep = async () => {
    let fields: string[] = [];
    if (current === 0) fields = ["age", "weight", "height"];
    if (current === 1) fields = ["gender", "goal"];
    if (current === 2) fields = ["preferencias"];
    setSubmitted(false);
    const isValid = await form.trigger(fields);
    if (isValid) api?.scrollNext();
  };

  const prevStep = () => {
    setSubmitted(false);
    api?.scrollPrev();
  };

  // ---------------- LOADING VIEW (só quando gerar plano/lista) ----------------
  if (showLoadingSteps) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary">
        <div>
          <Loader2 className="animate-spin h-12 w-12 mb-4 text-yellow-500 mx-auto" />
        </div>
        <div className="font-bold text-xl text-center text-primary mb-3">
          {loadingMessages[loadingStep] ?? "Finalizando seu cadastro..."}
        </div>
        <div className="text-muted-foreground text-center text-base">
          Aguarde, estamos preparando tudo para você!
        </div>
      </div>
    );
  }

  // ---------------- RENDER ----------------
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div ref={carouselWrapperRef} className="w-full max-w-2xl mx-auto overflow-x-hidden">
        <div className="mb-4 flex justify-center">
          <AppLogo />
        </div>

        <Progress value={progress} className="w-full mb-4" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Carousel setApi={setApi} className="w-full" opts={{ watchDrag: false }}>
              <CarouselContent>
                {/* PASSO 1: DADOS BÁSICOS */}
                <CarouselItem className="w-full">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl">Vamos Começar?</CardTitle>
                      <CardDescription>Nos conte um pouco sobre você para personalizarmos sua experiência.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-3 gap-8 pt-6">
                      {/* Idade */}
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Idade</FormLabel>
                            <div>
                              <FormControl>
                                <Input
                                  type="number"
                                  className="w-24 text-center text-2xl font-bold"
                                  value={field.value ?? ""}
                                  onChange={(e) => handleNumberChange(field, e.target.value)}
                                  step={1}
                                />
                              </FormControl>
                              <span className="text-lg text-muted-foreground">anos</span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Peso */}
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso</FormLabel>
                            <div>
                              <FormControl>
                                <Input
                                  type="number"
                                  className="w-24 text-center text-2xl font-bold"
                                  value={field.value ?? ""}
                                  onChange={(e) => handleNumberChange(field, e.target.value)}
                                  step={0.1}
                                />
                              </FormControl>
                              <span className="text-lg text-muted-foreground">kg</span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Altura */}
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Altura</FormLabel>
                            <div>
                              <FormControl>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-24 text-center text-2xl font-bold"
                                  value={field.value ?? ""}
                                  onChange={(e) => handleHeightChange(field, e.target.value)}
                                />
                              </FormControl>
                              <span className="text-lg text-muted-foreground">cm</span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <div className="mt-6 flex">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={current === 0}
                        className="w-1/2 h-16 rounded-lg rounded-r-none text-lg flex items-center justify-center"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="w-1/2 h-16 rounded-lg rounded-l-none text-lg flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-black"
                      >
                        Avançar
                      </Button>
                    </div>
                  </Card>
                </CarouselItem>

                {/* PASSO 2: GÊNERO E OBJETIVO */}
                <CarouselItem className="w-full">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl">Seu Corpo, Seus Objetivos</CardTitle>
                      <CardDescription>Qual seu gênero atribuído no nascimento e o que você busca alcançar?</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-8 pt-6">
                      {/* Gênero */}
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gênero atribuído no nascimento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? "female"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Masculino</SelectItem>
                                <SelectItem value="female">Feminino</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Objetivo */}
                      <FormField
                        control={form.control}
                        name="goal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Objetivo Principal</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? "lose"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="lose">Perder Peso</SelectItem>
                                <SelectItem value="maintain">Manter Peso</SelectItem>
                                <SelectItem value="gain">Ganhar Massa</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <div className="mt-6 flex">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="w-1/2 h-16 rounded-lg rounded-r-none text-lg flex items-center justify-center"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="w-1/2 h-16 rounded-lg rounded-l-none text-lg flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-black"
                      >
                        Avançar
                      </Button>
                    </div>
                  </Card>
                </CarouselItem>

                {/* PASSO 3: PREFERÊNCIAS */}
                <CarouselItem className="w-full">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl">Informações Adicionais</CardTitle>
                      <CardDescription>Conte preferências alimentares e restrições, dessa forma podemos personalizar suas recomendações.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="preferencias"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                as="textarea"
                                rows={4}
                                className="w-full bg-yellow-100 text-black border border-blue-500"
                                placeholder="Ex.: vegetariano, intolerância à lactose, alergias, gosto de receitas rápidas..."
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormDescription>Máx. 1000 caracteres. Campo opcional.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <div className="mt-6 flex">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="w-1/2 h-16 rounded-lg rounded-r-none text-lg flex items-center justify-center"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="w-1/2 h-16 rounded-lg rounded-l-none text-lg flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-black"
                      >
                        Avançar
                      </Button>
                    </div>
                  </Card>
                </CarouselItem>

                {/* PASSO 4: CADASTRO FINAL */}
                <CarouselItem className="w-full">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl">Crie sua Conta</CardTitle>
                      <CardDescription>Estamos quase lá! Preencha os dados abaixo para finalizar.</CardDescription>
                    </CardHeader>

                    {/* >>> MENSAGEM GRANDE EM VERMELHO NO ÚLTIMO PASSO <<< */}
                    {topError && (
                      <div
                        className="px-4 text-center text-red-600 font-extrabold text-lg md:text-xl mb-3"
                        aria-live="assertive"
                      >
                        {topError}
                      </div>
                    )}

                    <CardContent className="space-y-4 bg-white text-black border border-red-500">
                      {/* Nome Completo */}
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Seu nome"
                                {...field}
                                value={field.value ?? ""}
                                className="bg-yellow-100 text-black border border-blue-500"
                              />
                            </FormControl>
                            {submitted && <FormMessage />}
                          </FormItem>
                        )}
                      />
                      {/* E-mail */}
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="seu@email.com"
                                {...field}
                                value={field.value ?? ""}
                                className="bg-yellow-100 text-black border border-blue-500"
                              />
                            </FormControl>
                            {submitted && <FormMessage />}
                          </FormItem>
                        )}
                      />
                      {/* Senha */}
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="********"
                                {...field}
                                value={field.value ?? ""}
                                className="bg-yellow-100 text-black border border-blue-500"
                              />
                            </FormControl>
                            {submitted && <FormMessage />}
                          </FormItem>
                        )}
                      />
                      {/* Celular (Opcional) */}
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Celular (Opcional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="(XX) XXXXX-XXXX"
                                {...field}
                                value={field.value ?? ""}
                                className="bg-yellow-100 text-black border border-blue-500"
                                onChange={(e) => {
                                  // mantém digitação livre; normaliza na gravação
                                  field.onChange(e.target.value);
                                }}
                              />
                            </FormControl>
                            {submitted && <FormMessage />}
                          </FormItem>
                        )}
                      />
                      {/* Consentimento WhatsApp */}
                      <FormField
                        control={form.control}
                        name="consent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                            <FormControl>
                              <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Permitir Interação via WhatsApp</FormLabel>
                              <FormDescription>Usaremos seu número exclusivamente para registrar refeições via WhatsApp.</FormDescription>
                            </div>
                            {submitted && <FormMessage />}
                          </FormItem>
                        )}
                      />
                      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
                    </CardContent>
                    <div className="mt-6 flex">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="w-1/2 h-16 rounded-lg rounded-r-none text-lg flex items-center justify-center"
                        disabled={loading}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="submit"
                        className="w-1/2 h-16 rounded-lg rounded-l-none text-lg flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-black"
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Finalizar Cadastro"}
                      </Button>
                    </div>
                  </Card>
                </CarouselItem>
              </CarouselContent>
            </Carousel>
          </form>
        </Form>
      </div>
    </div>
  );
}
