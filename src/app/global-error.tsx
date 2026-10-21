"use client";

import { useEffect } from "react";

// Captura excepciones de cliente no controladas en cualquier ruta. Next renderiza
// aquí cuando un error escapa a todos los Error Boundaries. Mostramos el mensaje
// real (no el genérico "Application error...") y un botón para reintentar.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log explícito para que llegue a la consola del navegador y a Vercel.
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <head>
        {/* Sin globals.css ni providers: la paleta de la app a mano, clara u
            oscura según el sistema. */}
        <style>{`
          :root {
            --bg: #faf8f5; --surface: #ffffff; --border: #e8e0d8;
            --text: #1a1612; --text-secondary: #5c534a;
            --primary: #c87a1a; --primary-text: #ffffff;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #151118; --surface: #23202b; --border: #3a3548;
              --text: #f0ece8; --text-secondary: #a09890;
              --primary: #e8a840; --primary-text: #151118;
            }
          }
        `}</style>
      </head>
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "var(--bg)",
          color: "var(--text)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>🎲</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Algo ha fallado
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 16px" }}>
            Se ha producido un error inesperado. Suele arreglarse reintentando.
          </p>
          <pre
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              color: "var(--primary)",
              textAlign: "left",
              overflow: "auto",
              maxHeight: 160,
              margin: "0 0 16px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.message || "Error desconocido"}
            {error.digest ? `\n\nref: ${error.digest}` : ""}
          </pre>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "10px 20px",
                background: "var(--primary)",
                color: "var(--primary-text)",
                border: 0,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            {/* next/link no es válido en global-error: esto se renderiza fuera del layout raíz */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
