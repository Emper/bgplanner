import type { Metadata } from "next";
import SmartNav from "@/components/SmartNav";
import PageShell from "@/components/ui/PageShell";
import { Notice } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "No encontrado · BG Planner",
  robots: { index: false, follow: false },
};

// El 404 de toda la app (lo que no tenga su propio not-found.tsx).
export default function NotFound() {
  return (
    <PageShell nav={<SmartNav />} width="form">
      <Notice
        icon="🔍"
        title="Aquí no hay nada"
        actions={<ButtonLink href="/">Ir a BG Planner</ButtonLink>}
      >
        <p>Puede que la dirección haya cambiado, que lo hayan borrado o que el enlace esté mal copiado.</p>
      </Notice>
    </PageShell>
  );
}
