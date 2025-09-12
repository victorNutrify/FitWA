import { UserProfileForm } from "@/components/dashboard/UserProfileForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfilePage() {
    return (
        <div className="container mx-auto py-10">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Perfil do Usuário</CardTitle>
                    <CardDescription>Atualize suas informações pessoais. Isso é usado para calcular suas necessidades diárias.</CardDescription>
                </CardHeader>
                <CardContent>
                    <UserProfileForm />
                </CardContent>
            </Card>
        </div>
    )
}
