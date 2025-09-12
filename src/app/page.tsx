import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLogo } from '@/components/app-logo';
import { 
  BotMessageSquare, 
  Brain, 
  ShoppingCart, 
  Camera, 
  ScanBarcode, 
  BarChart2, 
  User, 
  FileDown,
  ChefHat 
} from 'lucide-react';

const features = [
  {
    icon: <BotMessageSquare className="h-8 w-8 text-primary" />,
    title: 'Registro de Refeições por WhatsApp',
    description: 'Diga ao nosso IA o que você comeu via WhatsApp. Rápido, fácil e conversacional, sem precisar abrir o app.',
  },
  {
    icon: <Camera className="h-8 w-8 text-primary" />,
    title: 'Registro da Sua Refeição por Imagem',
    description: 'Tire uma foto do que irá comer. Nossa IA identificará os ingredientes e a registrará para você.',
  },
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: 'Plano de Refeições Personalizado',
    description: 'Receba um plano de refeições feito sob medida com base nas suas metas e preferências alimentares.',
  },
  {
    icon: <ShoppingCart className="h-8 w-8 text-primary" />,
    title: 'Lista de Compras Inteligente',
    description: 'Gere automaticamente uma lista de compras com os ingredientes exatos do seu plano de refeições.',
  },
  {
    icon: <ChefHat className="h-8 w-8 text-primary" />,
    title: 'Receitas com o que Você Tem',
    description: 'Nossa IA cria receitas com o que você tem em casa, sem fugir da meta e evitando a monotonia.',
  },
  {
    icon: <User className="h-8 w-8 text-primary" />,
    title: 'Metas Personalizadas',
    description: 'Defina seus objetivos e nós calcularemos suas metas diárias para ajudá-lo a ter sucesso.',
  },
  {
    icon: <BarChart2 className="h-8 w-8 text-primary" />,
    title: 'Gráficos de Progresso',
    description: 'Visualize sua jornada com belos gráficos para calorias, macros e progresso de peso.',
  },
  {
    icon: <ScanBarcode className="h-8 w-8 text-primary" />,
    title: 'Leitor de Código de Barras',
    description: 'Escaneie códigos de barras para registrar informações nutricionais instantâneas e precisas de alimentos.',
  },
  {
    icon: <FileDown className="h-8 w-8 text-primary" />,
    title: 'Exportação de Dados',
    description: 'Leve seus dados com você. Exporte seu histórico de refeições para PDF ou CSV a qualquer momento.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <AppLogo />
        <nav>
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild className="ml-2">
            <Link href="/onboarding">Comece Agora</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-grow">
        <section className="text-center py-20 lg:py-32">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight">
              Controle sua Nutrição via <span className="text-green-500">WhatsApp</span>.
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
              Esqueça os apps complicados. Envie uma mensagem ou foto do que você comeu e nossa IA cuida de todo o resto. Simples assim.
            </p>
            <div className="mt-10">
              <Button asChild size="lg">
                <Link href="/onboarding">Comece Sua Jornada de Graça</Link>
              </Button>
            </div>
          </div>
        </section>
        
        <section id="features" className="py-20 lg:py-24 bg-secondary">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-headline text-4xl md:text-5xl font-bold">Uma Forma Mais Inteligente de Acompanhar</h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                Todas as ferramentas que você precisa para entender e melhorar sua nutrição, com o poder da IA.
              </p>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="text-center shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
                  <CardHeader className="items-center p-4">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                      {feature.icon}
                    </div>
                    <CardTitle className="font-headline text-xl mt-3">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow px-4 pb-4">
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        
        <section className="py-20 lg:py-24">
           <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="font-headline text-4xl md:text-5xl font-bold">Pronto para Simplificar sua Nutrição?</h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">Junte-se a nós e transforme a maneira como você interage com seus objetivos de saúde.</p>
              <div className="mt-10">
                <Button asChild size="lg">
                    <Link href="/onboarding">Crie sua Conta Gratuita</Link>
                </Button>
              </div>
           </div>
        </section>
      </main>

      <footer className="bg-secondary py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ChatFit Companion. Todos os Direitos Reservados.</p>
        </div>
      </footer>
    </div>
  );
}