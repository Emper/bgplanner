"use client";

import { useState, type ReactNode } from "react";
import { formatRelativeTime } from "@/lib/format";
import { bggGeeklistUrl } from "@/lib/bggLinks";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { FieldError, Input } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/Tabs";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

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
        href={bggGeeklistUrl(event.bggGeeklistId)}
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
  const toast = useToast();
  const confirm = useConfirm();

  const run = async (kind: "link" | "sync", req: Promise<Response>) => {
    setBusy(kind);
    setError("");
    try {
      const res = await req;
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) {
        toast(data.message || "BGG aún está preparando la lista");
        onChanged();
      } else if (res.ok) {
        toast(resultMessage(data, kind === "link"));
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
    const ok = await confirm({
      title: "¿Volver a elegir los juegos a mano?",
      body: "Los que hay ahora se quedan, pero dejarán de seguir a la lista de BGG.",
      confirmLabel: "Elegirlos a mano",
    });
    if (!ok) return;
    setBusy("unlink");
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/geeklist`, { method: "DELETE" });
      if (res.ok) {
        setChoice("manual");
        toast("Ahora los juegos los eliges tú");
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se ha podido desvincular la lista");
      }
    } catch {
      setError("No se ha podido conectar. Inténtalo de nuevo.");
    } finally {
      setBusy("");
    }
  };

  const options = [
    { value: "manual" as const, label: <><span aria-hidden>✋</span> Los elijo yo</> },
    { value: "geeklist" as const, label: <><span aria-hidden>📋</span> Lista de BGG</> },
  ];

  const onChoose = (value: "manual" | "geeklist") => {
    if (busy || value === choice) return;
    if (value === "manual") {
      chooseManual();
    } else {
      setChoice("geeklist");
      setError("");
    }
  };

  return (
    <div className="mb-4">
      <div className={cardClass({ padding: "sm", className: "sm:p-4" })}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--text)]">¿De dónde salen los juegos?</span>
          <SegmentedControl
            label="Origen de los juegos"
            value={choice}
            onChange={onChoose}
            options={options}
            className={busy ? "opacity-60 pointer-events-none" : ""}
          />
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
              <Input
                type="url"
                inputMode="url"
                aria-label="Enlace de la geeklist de BGG"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://boardgamegeek.com/geeklist/…"
                disabled={!!busy}
                size="sm"
                className="flex-1 min-w-0"
              />
              <Button type="submit" disabled={!url.trim() || (!!busy && busy !== "link")} loading={busy === "link"}>
                {busy === "link" ? "Importando…" : "Vincular lista"}
              </Button>
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
                href={bggGeeklistUrl(event.bggGeeklistId)}
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
                <div className="text-xs text-[var(--warning)] mt-1">⚠️ {event.geeklistError}</div>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={sync} disabled={!!busy} className="shrink-0">
              {busy === "sync" ? <><Spinner size="xs" tone="current" /> Reimportando…</> : "↻ Reimportar ahora"}
            </Button>
          </div>
        )}

        <FieldError className="mt-2 text-xs sm:text-sm">{error}</FieldError>
      </div>

      {choice === "manual" && !linked && <div className="mt-3">{children}</div>}
    </div>
  );
}
