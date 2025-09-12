import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
    {
        name: "Grátis",
        price: "R$0",
        period: "/sempre",
        description: "Para começar sua jornada.",
        features: [
            "Registro de refeições manual",
            "Acesso a gráficos básicos",
            "Cálculo de metas diárias",
            "\u00A0", // Placeholder
            "\u00A0"  // Placeholder
        ],
        isSuggested: false
    },
    {
        name: "Pro Mensal",
        price: "R$XX,95",
        period: "/mês",
        originalPrice: "R$XX,90",
        discount: "50% OFF",
        description: "Para levar a sério seus objetivos.",
        features: [
            "Todas as funcionalidades do plano Grátis",
            "Registro por WhatsApp e Imagem",
            "Plano de refeições personalizado",
            "Lista de compras inteligente",
            "Receitas com o que você tem em casa"
        ],
        isSuggested: false
    },
    {
        name: "Pro Anual",
        price: "12x R$XX,90",
        period: "", // O período agora está no preço
        originalPrice: "12x R$XX,90",
        discount: "39% OFF",
        description: "Plano Pro com mais economia.",
        features: [
            "Todas as funcionalidades do plano Pro",
            "Economize com o plano anual",
            "Acesso prioritário a novas funcionalidades",
            "\u00A0", // Placeholder
            "\u00A0"  // Placeholder
        ],
        isSuggested: true
    },
    {
        name: "Família",
        price: "R$XX,90",
        period: "/mês",
        originalPrice: "R$XX,90",
        discount: "25% OFF",
        description: "Para toda a família ficar em forma junta.",
        features: [
            "Todas as funcionalidades do plano Pro",
            "Até 4 usuários na mesma conta",
            "Competições e rankings entre os membros",
            "Relatórios de progresso consolidados",
            "\u00A0"  // Placeholder
        ],
        isSuggested: false
    }
];

export default function SubscriptionPage() {
    return (
        <div className="container mx-auto py-10">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">Nossos Planos</h1>
                <p className="text-muted-foreground mt-2">Escolha o plano que melhor se adapta à sua jornada.</p>
            </div>
            {/* Adicionado py-8 para dar espaço para o card crescer */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch py-8">
                {plans.map(plan => (
                    <Card 
                        key={plan.name} 
                        className={cn(
                            "flex flex-col transition-transform duration-300",
                            plan.isSuggested ? 'border-primary shadow-lg -mt-8' : ''
                        )}
                    >
                        {plan.isSuggested && (
                            <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-semibold rounded-t-lg">
                                Nossa Sugestão
                            </div>
                        )}
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-headline">{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col">
                            <div className="text-center mb-6 flex flex-col min-h-[7rem]">
                                <div className="h-12">
                                    {plan.originalPrice && (
                                        <div>
                                            <Badge variant="destructive">{plan.discount}</Badge>
                                            <p className="text-lg text-muted-foreground/80 line-through mt-1">
                                                {plan.originalPrice}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-auto">
                                    <span className="text-2xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground">{plan.period}</span>
                                </div>
                            </div>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start min-h-[2.5rem]">
                                        {feature.trim() && <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1" />}
                                        <span className="text-muted-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button className="w-full mt-auto">
                                {plan.name === "Grátis" ? "Continuar Grátis" : "Selecionar Plano"}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
