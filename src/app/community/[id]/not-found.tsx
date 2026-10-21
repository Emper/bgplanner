import SmartNav from "@/components/SmartNav";
import PageShell from "@/components/ui/PageShell";
import { Notice } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

// Hilo borrado o enlace mal copiado: 404 de verdad (para los buscadores) con
// salida a la Comunidad.
export default function ThreadNotFound() {
  return (
    <PageShell nav={<SmartNav />} width="form">
      <Notice
        icon="🫥"
        title="Esta conversación ya no está"
        actions={<ButtonLink href="/community">Volver a la Comunidad</ButtonLink>}
      >
        <p>Puede que la hayan borrado o que el enlace no sea correcto.</p>
      </Notice>
    </PageShell>
  );
}
