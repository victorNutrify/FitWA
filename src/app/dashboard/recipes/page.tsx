import { RecipeGenerator } from "@/components/dashboard/RecipeGenerator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecipesPage() {
    return (
        <div className="container mx-auto py-10">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Gerador de Receitas</CardTitle>
                    <CardDescription>
                        Diga à nossa IA quais ingredientes você tem em casa e ela criará uma receita para você.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RecipeGenerator />
                </CardContent>
            </Card>
        </div>
    );
}
