import { Loader2 } from "lucide-react";

export default function Loading() {
  // Você pode adicionar qualquer UI aqui, incluindo um Skeleton.
  // Para este caso, uma animação de carregamento centralizada é ideal.
  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
