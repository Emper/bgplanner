"use client";

import { useState, type ReactNode } from "react";
import { formatRelativeTime } from "@/lib/format";

export interface GeeklistState {
  bggGeeklistId: number | null;
  geeklistTitle: string | null;
  geeklistSyncedAt: string | null;
  geeklistError: string | null;
}

interface SyncResult {
  total: number;
  added: number;
  removed: number;
  flagged: number;
}

const geeklistUrl = (id: number) => `https://boardgamegeek.com/geeklist/${id}`;

function resultMessage(r: SyncResult, first: boolean) {
  const parts = [
    first
      ? `Lista vinculada: ${r.total} ${r.total === 1 ? "juego" : "juegos"}`
      : r.added > 0
        ? `${r.added} ${r.added === 1 ? "juego nuevo" : "juegos nuevos"} de la lista`
        : "La lista está al día",
  ];
  if (r.removed > 0) parts.push(`${r.removed} ya no ${r.removed === 1 ? "estaba" : "estaban"} y se ${r.removed === 1 ? "ha" : "han"} quitado`);
  if (r.flagged > 0) parts.push(`${r.flagged} con interés se ${r.flagged === 1 ? "queda" : "quedan"} señalado${r.flagged === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Para quien no gestiona el evento: de dónde salen los juegos. */
export function GeeklistNotice({ event }: { event: GeeklistState }) {
  if (!event.bggGeeklistId) return null;
  return (
    <p className="mb-4 text-sm text-[var(--text-secondary)]">
      📋 Los juegos salen de la lista{" "}
      <a
        href={geeklistUrl(event.bggGeeklistId)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors"
      >
        {event.geeklistTitle ? `«${event.geeklistTitle}»` : "de BGG"}
      </a>{" "}
      de BGG y se van actualizando cuando cambia.
    </p>
  );
}

/**
 * El «switch» de la pestaña Juegos para quien gestiona el evento: elegir los
 * juegos a mano (lo de siempre, `children` es el buscador) o tomarlos de una
 * geeklist de BGG que se reimporta sola.
 */
export default function GeeklistPanel({
  eventId,
  event,
  onChanged,
  children,
}: {
  eventId: string;
  event: GeeklistState;
  onChanged: () => void;
  children: ReactNode;
}) {
  const linked = !!event.bggGeeklistId;
  const [choice, setChoice] = useState<"manual" | "geeklist">(linked ? "geeklist" : "manual");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "link" | "sync" | "unlink">("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  const run = async (kind: "link" | "sync", req: Promise<Response>) => {
    setBusy(kind);
    setError("");
    try {
      const res = await req;
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) {
        showToast(data.message || "BGG aún está preparando la lista");
        onChanged();
      } else if (res.ok) {
        showToast(resultMessage(data, kind === "link"));
        if (kind === "link") setUrl("");
        onChanged();
      } else {
        setError(data.error || "No se ha podido leer la lista de BGG");
      }
    } catch {
      setError("No se ha podido conectar. Inténtalo de nuevo.");
    } finally {
      setBusy("");
    }
  };

  const link = () =>
    run(
      "link",
      fetch(`/api/events/${eventId}/geeklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
    );

  const sync = () => run("sync", fetch(`/api/events/${eventId}/geeklist/sync`, { method: "POST" }));

  const chooseManual = async () => {
    if (!linked) {
      setChoice("manual");
      setError("");
      return;
    }
    if (!confirm("¿Volver a elegir los juegos a mano? Los que hay ahora se quedan, pero dejarán de seguir a la lista de BGG.")) return;
    setBusy("unlink");
    try {
      const res = await fetch(`/api/events/${eventId}/geeklist`, { method: "DELETE" });
      if (res.ok) {
        setChoice("manual");
        showToast("Ahora los juegos los eliges tú");
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se ha podido desvincular la lista");
      }
    } finally {
      setBusy("");
    }
  };

  const options = [
    { key: "manual" as const, label: "Los elijo yo", emoji: "✋" },
    { key: "geeklist" as const, label: "Lista de BGG", emoji: "📋" },
  ];

  return (
    <div className="mb-4">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--text)]">¿De dónde salen los juegos?</span>
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-0.5" role="radiogroup" aria-label="Origen de los juegos">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={choice === o.key}
                disabled={!!busy}
                onClick={() => (o.key === "manual" ? chooseManual() : (setChoice("geeklist"), setError("")))}
                className={`px-3 py-1.5 rounded-[10px] text-xs sm:text-sm font-medium transition-colors disabled:opacity-60 ${
                  choice === o.key
                    ? "bg-[var(--primary)] text-[var(--primary-text)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                <span aria-hidden>{o.emoji}</span> {o.label}
              </button>
            ))}
          </div>
        </div>

        {choice === "geeklist" && !linked && (
          <div className="mt-3">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-2.5">
              Pega el enlace de una geeklist de BGG (la ludoteca de unas jornadas, por ejemplo). El evento tendrá
              sus juegos y se irá actualizando cuando cambie. Los intereses ya marcados en juegos que estén en la
              lista se conservan.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim() && !busy) link();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://boardgamegeek.com/geeklist/…"
                disabled={!!busy}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              />
              <button
                type="submit"
                disabled={!url.trim() || !!busy}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-text)] text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {busy === "link" ? "Importando…" : "Vincular lista"}
              </button>
            </form>
            {busy === "link" && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                La primera vez BGG puede tardar hasta un minuto en preparar la lista. No cierres la página.
              </p>
            )}
          </div>
        )}

        {linked && event.bggGeeklistId && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <a
                href={geeklistUrl(event.bggGeeklistId)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors break-words"
              >
                {event.geeklistTitle ? `«${event.geeklistTitle}»` : `Lista ${event.bggGeeklistId}`} ↗
              </a>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {busy === "sync"
                  ? "Reimportando… puede tardar si BGG está preparando la lista"
                  : event.geeklistSyncedAt
                    ? `Actualizada ${formatRelativeTime(event.geeklistSyncedAt)}. Se reimporta sola cada poco mientras se consulta el evento.`
                    : "Aún sin importar."}
              </div>
              {event.geeklistError && busy !== "sync" && (
                <div className="text-xs text-amber-400 mt-1">⚠️ {event.geeklistError}</div>
              )}
            </div>
            <button
              type="button"
              onClick={sync}
              disabled={!!busy}
              className="shrink-0 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors"
            >
              {busy === "sync" ? "Reimportando…" : "↻ Reimportar ahora"}
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-xs sm:text-sm text-red-400">{error}</p>}
      </div>

      {choice === "manual" && !linked && <div className="mt-3">{children}</div>}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-lg text-sm text-[var(--text)] max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
