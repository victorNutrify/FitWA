"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Mostra um overlay de loading sempre que o usuário clicar em um link interno.
 * Esconde quando a navegação finalizar (pathname OU search params mudarem).
 */
export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = React.useState(false);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const hardStopRef = React.useRef<number | null>(null);

  // Esconde o overlay com um pequeno grace-period (evita flickers)
  const hide = React.useCallback((delay = 150) => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      if (hardStopRef.current) {
        window.clearTimeout(hardStopRef.current);
        hardStopRef.current = null;
      }
    }, delay) as unknown as number;
  }, []);

  // Mostra imediatamente e seta um “hard stop” de segurança
  const show = React.useCallback(() => {
    if (!visible) setVisible(true);
    // Fallback: se algo travar, some após 10s
    if (hardStopRef.current) window.clearTimeout(hardStopRef.current);
    hardStopRef.current = window.setTimeout(() => setVisible(false), 10000) as unknown as number;
  }, [visible]);

  // Detecta cliques em links internos
  React.useEffect(() => {
    function isInternalLink(a: HTMLAnchorElement) {
      try {
        const url = new URL(a.href, window.location.href);
        const sameOrigin = url.origin === window.location.origin;
        const isFile = !!a.getAttribute("download");
        const targetBlank = a.target && a.target.toLowerCase() === "_blank";
        const rel = (a.rel || "").toLowerCase();
        const isExternalRel = rel.includes("external");
        const isSpecial = url.protocol === "mailto:" || url.protocol === "tel:";
        return sameOrigin && !isFile && !targetBlank && !isExternalRel && !isSpecial;
      } catch {
        return false;
      }
    }

    const onClick = (e: MouseEvent) => {
      // Só capturamos botões/gestos “normais” (sem ctrl/cmd/alt/shift)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a || !a.href) return;
      if (!isInternalLink(a)) return;

      // Ignora anchors na mesma página (#hash)
      const url = new URL(a.href, window.location.href);
      const current = new URL(window.location.href);
      const samePath = url.pathname === current.pathname && url.search === current.search;
      const onlyHashChange = samePath && url.hash !== current.hash;
      if (onlyHashChange) return;

      // Mostra overlay
      show();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [show]);

  // Quando o pathname OU os search params mudarem, consideramos a navegação concluída
  React.useEffect(() => {
    if (visible) hide(150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  if (!visible) return null;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">Carregando…</span>
      </div>
    </div>
  );
}
