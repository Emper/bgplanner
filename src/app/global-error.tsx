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
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "#0f172a",
          color: "#f1f5f9",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎲</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Algo ha fallado
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>
            Se ha producido un error inesperado. Suele arreglarse reintentando.
          </p>
          <pre
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              color: "#f59e0b",
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
              onClick={() => reset()}
              style={{
                padding: "10px 20px",
                background: "#f59e0b",
                color: "#0f172a",
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
                color: "#f1f5f9",
                border: "1px solid #334155",
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
