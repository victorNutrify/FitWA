import Link from 'next/link';
import { Leaf } from 'lucide-react';

export function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="NutriAI Companion Home">
      <div className="bg-primary p-2 rounded-lg">
        <Leaf className="h-6 w-6 text-primary-foreground" />
      </div>
      <span className="text-xl font-bold tracking-tight font-headline">
        ChatFit
      </span>
    </Link>
  );
}
