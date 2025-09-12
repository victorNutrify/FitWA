"use client";

import Link from 'next/link';
import {
  Home,
  Utensils,
  Salad,
  ShoppingCart,
  ChefHat,
  BarChartBig,
  UserCog,
  Bot,
  Settings,
  Menu,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AppLogo } from '@/components/app-logo';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ordem dos itens conforme solicitado
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Painel' },
    { href: '/dashboard/register-meal', icon: Utensils, label: 'Registrar Refeição' },
    { href: '/dashboard/diet-plan-suggestion', icon: Salad, label: 'Sugestão de Plano de Dieta' },
    { href: '/dashboard/shopping-list', icon: ShoppingCart, label: 'Lista de Compras dos Alimentos' },
    { href: '/dashboard/recipes', icon: ChefHat, label: 'Receitas Personalizadas' }, // CORRIGIDO!
    { href: '/dashboard/reports', icon: BarChartBig, label: 'Relatórios' },
    { href: '/dashboard/profile', icon: UserCog, label: 'Mudar seus dados e meta' }, // CORRIGIDO!
    { href: '/dashboard/chatAi', icon: Bot, label: 'Falar com IA' },
    { href: '/dashboard/settings', icon: Settings, label: 'Configurações' },
  ];

  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[165px_1fr] lg:grid-cols-[210px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <AppLogo />
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Card>
              <CardHeader className="p-2 pt-0 md:p-4">
                <CardTitle>Atualize para o Pro</CardTitle>
                <CardDescription>
                  Desbloqueie todos os recursos e obtenha acesso ilimitado à nossa equipe de suporte.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
                <Link 
                  href="/dashboard/subscription" 
                  className={cn(buttonVariants({ size: "sm" }), "w-full")}
                >
                  Atualizar
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Alternar menu de navegação</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium">
                <div className="mb-4">
                    <AppLogo />
                </div>
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Atualize para o Pro</CardTitle>
                    <CardDescription>
                      Desbloqueie todos os recursos e obtenha acesso ilimitado à nossa equipe de suporte.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link 
                      href="/dashboard/subscription" 
                      className={cn(buttonVariants({ size: "sm" }), "w-full")}
                    >
                      Atualizar
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Image
                  src={`https://placehold.co/36x36.png`}
                  width={36}
                  height={36}
                  alt="Avatar"
                  className="rounded-full"
                  data-ai-hint="user avatar"
                />
                <span className="sr-only">Alternar menu de usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Configurações</DropdownMenuItem>
              <DropdownMenuItem>Suporte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
          {(!loading && user) ? children : null}
        </main>
      </div>
    </div>
  );
}