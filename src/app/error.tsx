"use client";

import { useEffect } from "react";
import { Notice } from "@/components/ui/EmptyState";
import Button, { ButtonLink } from "@/components/ui/Button";

// Un fallo inesperado en una página: se queda dentro de la app (con su tema)
// en vez de tumbarla entera. global-error.tsx solo salta si falla el layout.
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg)] page-pad flex items-center">
      <div className="page-form w-full">
        <Notice
          icon="🎲"
          title="Algo se ha torcido"
          actions={
            <>
              <Button onClick={reset}>Reintentar</Button>
              <ButtonLink href="/" variant="secondary">
                Ir al inicio
              </ButtonLink>
            </>
          }
        >
          <p>Ha fallado algo al cargar esta página. Prueba otra vez y, si sigue, cuéntanoslo desde Contacto.</p>
        </Notice>
      </div>
    </div>
  );
}
