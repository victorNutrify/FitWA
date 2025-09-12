
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Palette } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
    return (
        <>
            <div className="flex items-center mb-4">
                <h1 className="text-lg font-semibold md:text-2xl font-headline">Configurações</h1>
            </div>
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Notificações</CardTitle>
                        <CardDescription>
                            Gerencie como você recebe notificações do aplicativo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="push-notifications" className="flex flex-col space-y-1">
                                <span>Notificações Push</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Receba lembretes de refeições e atualizações de metas no seu dispositivo.
                                </span>
                            </Label>
                            <Switch id="push-notifications" />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                                <span>Notificações por E-mail</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Receba relatórios semanais e dicas por e-mail.
                                </span>
                            </Label>
                            <Switch id="email-notifications" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Aparência</CardTitle>
                        <CardDescription>
                            Personalize a aparência do aplicativo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                           <Label>
                            Mudar Tema
                           </Label>
                           <ThemeToggle />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
