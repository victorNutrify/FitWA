import { Loader2 } from "lucide-react";

export default function Loading() {
  // Este componente de carregamento usa o mesmo fundo da página de signup
  // para uma transição suave.
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
