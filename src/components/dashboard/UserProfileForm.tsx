"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog"

const nameFormSchema = z.object({
  nickname: z.string().min(2, "Como gostaria de ser chamado?"),
})
const phoneFormSchema = z.object({
  phone: z.string()
    .refine((val) => /^\d{11}$/.test(val), {
      message: "Digite exatamente 11 números (DDD + número, sem traços, espaços ou parênteses)."
    }),
})
const nutritionFormSchema = z.object({
  age: z.coerce.number().min(14, "A idade deve ser no mínimo 14 anos."),
  weight: z.coerce.number().min(30, "O peso deve ser no mínimo 30 kg."),
  height: z.coerce
    .number({ invalid_type_error: "Por favor, insira um número." })
    .min(110, "Use centímetros para a altura (ex: para 1,75m, digite 175).")
    .int("Use um número inteiro para centímetros (ex: 175)."),
  gender: z.enum(["male", "female"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
})

type NameFormValues = z.infer<typeof nameFormSchema>
type PhoneFormValues = z.infer<typeof phoneFormSchema>
type NutritionFormValues = z.infer<typeof nutritionFormSchema>

const defaultNameValues: NameFormValues = { nickname: "" }
const defaultPhoneValues: PhoneFormValues = { phone: "" }
const defaultNutritionValues: NutritionFormValues = {
  age: 30,
  weight: 70,
  height: 175,
  gender: "male",
  activityLevel: "light",
  goal: "maintain",
}

function calculateMacros(values: NutritionFormValues) {
  const { weight, height, age, gender, activityLevel, goal } = values
  let bmr = 10 * weight + 6.25 * height - 5 * age
  bmr += gender === "male" ? 5 : -161

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }
  let calories = bmr * activityMultipliers[activityLevel]

  if (goal === "lose") calories -= 400
  if (goal === "gain") calories += 400

  let protein = goal === "gain" ? weight * 2.2 : weight * 1.8
  let fat = (calories * 0.25) / 9
  let carbs = (calories - (protein * 4 + fat * 9)) / 4

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  }
}

export function UserProfileForm() {
  const { toast } = useToast()

  // Estados dos formulários
  const nameForm = useForm<NameFormValues>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: defaultNameValues,
    mode: "onChange",
  })
  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: defaultPhoneValues,
    mode: "onChange",
  })
  const nutritionForm = useForm<NutritionFormValues>({
    resolver: zodResolver(nutritionFormSchema),
    defaultValues: defaultNutritionValues,
    mode: "onChange",
  })

  // Estado para resultado nutricional
  const [nutritionResults, setNutritionResults] = useState<ReturnType<typeof calculateMacros> | null>(null)

  // Estados para diálogos
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMessage, setDialogMessage] = useState("")
  const [pendingAction, setPendingAction] = useState<"name" | "phone" | "nutrition" | null>(null)

  // Controle do envio de formulário
  function handleSubmitName(data: NameFormValues) {
    setDialogMessage(
      "Confirma a alteração de nome? Apenas a forma como você é chamado será atualizada."
    )
    setPendingAction("name")
    setDialogOpen(true)
  }
  function handleSubmitPhone(data: PhoneFormValues) {
    setDialogMessage(
      "Deseja realmente atualizar seu número de WhatsApp? Todas as mensagens e notificações passarão a ser enviadas para o novo número informado."
    )
    setPendingAction("phone")
    setDialogOpen(true)
  }
  function handleSubmitNutrition(data: NutritionFormValues) {
    setDialogMessage(
      "Tem certeza que deseja atualizar seu perfil nutricional? Sua rotina alimentar será recalculada e as recomendações de dieta podem ser alteradas."
    )
    setPendingAction("nutrition")
    setDialogOpen(true)
  }

  // Confirmação do diálogo
  function handleDialogConfirm() {
    if (pendingAction === "name") {
      toast({
        title: "Nome atualizado!",
        description: "Seu nome foi alterado com sucesso.",
      })
      // Aqui você pode enviar para o backend
    }
    if (pendingAction === "phone") {
      toast({
        title: "Número atualizado!",
        description: "Seu número foi alterado. Agora enviaremos mensagens e notificações para o novo número.",
      })
      // Aqui você pode enviar para o backend
    }
    if (pendingAction === "nutrition") {
      toast({
        title: "Perfil nutricional atualizado!",
        description: "Sua rotina alimentar foi recalculada.",
      })
      setNutritionResults(calculateMacros(nutritionForm.getValues()))
      // Aqui você pode enviar para o backend
    }
    setDialogOpen(false)
    setPendingAction(null)
  }
  function handleDialogCancel() {
    setDialogOpen(false)
    setPendingAction(null)
  }

  // Permitir apenas números no campo telefone
  const handlePhoneChange = (field: any, value: string) => {
    const cleanedValue = value.replace(/\D/g, "");
    field.onChange(cleanedValue);
  };
  // Permitir apenas números nos sliders
  const handleInputChange = (field: any, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      field.onChange(num);
    }
  };

  return (
    <div className="space-y-10">
      {/* Formulário de nome */}
      <Form {...nameForm}>
        <form
          onSubmit={nameForm.handleSubmit(handleSubmitName)}
          className="space-y-4"
        >
          <FormField
            control={nameForm.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="nickname">Como gostaria de ser chamado?</FormLabel>
                <FormControl>
                  <Input {...field} id="nickname" placeholder="Seu nome social ou apelido" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Atualizar Nome
          </Button>
        </form>
      </Form>

      {/* Formulário de telefone */}
      <Form {...phoneForm}>
        <form
          onSubmit={phoneForm.handleSubmit(handleSubmitPhone)}
          className="space-y-4"
        >
          <FormField
            control={phoneForm.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="phone">Número do WhatsApp</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    id="phone"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="Ex: 11987654321"
                    onChange={e => handlePhoneChange(field, e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Atualizar Número do WhatsApp
          </Button>
        </form>
      </Form>

      {/* Formulário nutricional */}
      <Form {...nutritionForm}>
        <form
          onSubmit={nutritionForm.handleSubmit(handleSubmitNutrition)}
          className="space-y-8"
        >
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <FormField
              control={nutritionForm.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="age">Idade</FormLabel>
                  <FormControl>
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Input
                          type="number"
                          id="age"
                          className="w-24 text-center text-2xl font-bold"
                          value={field.value}
                          onChange={e => handleInputChange(field, e.target.value)}
                          step={1}
                        />
                        <span className="text-lg text-muted-foreground">anos</span>
                      </div>
                      <Slider
                        value={[field.value]}
                        min={14}
                        max={99}
                        step={1}
                        onValueChange={value => field.onChange(value[0])}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={nutritionForm.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="weight">Peso</FormLabel>
                  <FormControl>
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Input
                          type="number"
                          id="weight"
                          className="w-24 text-center text-2xl font-bold"
                          value={field.value}
                          onChange={e => handleInputChange(field, e.target.value)}
                          step={0.1}
                        />
                        <span className="text-lg text-muted-foreground">kg</span>
                      </div>
                      <Slider
                        value={[field.value]}
                        min={30}
                        max={250}
                        step={0.1}
                        onValueChange={value => field.onChange(value[0])}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={nutritionForm.control}
              name="height"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="height">Altura</FormLabel>
                  <FormControl>
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Input
                          type="number"
                          id="height"
                          className="w-24 text-center text-2xl font-bold"
                          value={field.value}
                          onChange={e => handleInputChange(field, e.target.value)}
                          step={1}
                        />
                        <span className="text-lg text-muted-foreground">cm</span>
                      </div>
                      <Slider
                        value={[field.value]}
                        min={110}
                        max={220}
                        step={1}
                        onValueChange={value => field.onChange(value[0])}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FormField
              control={nutritionForm.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="gender">Gênero</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Selecione seu gênero" />
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
            <FormField
              control={nutritionForm.control}
              name="activityLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="activityLevel">Nível de Atividade</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="activityLevel">
                        <SelectValue placeholder="Selecione seu nível de atividade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentário (pouco ou nenhum exercício)</SelectItem>
                      <SelectItem value="light">Levemente ativo (pratica exercícios 1-3 dias/semana)</SelectItem>
                      <SelectItem value="moderate">Moderadamente ativo (pratica exercícios 3-5 dias/semana)</SelectItem>
                      <SelectItem value="active">Muito ativo (pratica exercícios 6-7 dias/semana)</SelectItem>
                      <SelectItem value="very_active">Extra ativo (pratica exercícios muito pesado 7 dias/semana)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={nutritionForm.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="goal">Objetivo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="goal">
                        <SelectValue placeholder="Selecione seu objetivo principal" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lose">Perder Peso</SelectItem>
                      <SelectItem value="maintain">Manter Peso</SelectItem>
                      <SelectItem value="gain">Ganhar Peso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="w-full">
            Atualizar Perfil Nutricional
          </Button>
        </form>
      </Form>

      {/* Diálogo de confirmação - ACESSÍVEL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmação</DialogTitle>
          </DialogHeader>
          <div className="mb-4">{dialogMessage}</div>
          <DialogFooter>
            <Button onClick={handleDialogConfirm} className="w-full" variant="default">
              Confirmar alteração
            </Button>
            <Button onClick={handleDialogCancel} className="w-full" variant="outline">
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultados nutricionais */}
      {nutritionResults && (
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-2">Resultados Nutricionais</h3>
          <table className="w-full border text-center">
            <thead>
              <tr className="bg-muted">
                <th className="p-2">Calorias (kcal)</th>
                <th className="p-2">Proteínas (g)</th>
                <th className="p-2">Carboidratos (g)</th>
                <th className="p-2">Gorduras (g)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2">{nutritionResults.calories}</td>
                <td className="p-2">{nutritionResults.protein}</td>
                <td className="p-2">{nutritionResults.carbs}</td>
                <td className="p-2">{nutritionResults.fat}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}