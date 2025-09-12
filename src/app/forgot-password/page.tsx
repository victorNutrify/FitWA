import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ForgotPasswordPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <div className="mb-4 flex justify-center">
                        <AppLogo />
                    </div>
                    <CardTitle className="font-headline text-3xl">Esqueceu a senha?</CardTitle>
                    <CardDescription>
                        Insira seu e-mail para receber um link para redefinir sua senha.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@exemplo.com"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Enviar link para redefinição de senha
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        <Link href="/login" className="underline">
                            Voltar para o login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
