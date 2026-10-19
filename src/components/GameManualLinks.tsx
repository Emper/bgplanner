"use client";

import { useState } from "react";
import { MoreMenu, ReportModal } from "@/components/Moderation";
import { checkManualUrl, manualSourceLabel, manualTitleFromUrl } from "@/lib/bggLinks";

export interface ManualGame {
  id: string;
  bggId: number;
  name: string;
  manualUrl: string | null;
  manualAddedById: string | null;
}

/**
 * A la derecha de un juego: si alguien ha enlazado el manual (en BGG, Drive,
 * Dropbox…), un botón «📖 Manual»; si no, un discreto «Enlazar manual» que
 * puede usar cualquiera. Cambiarlo o quitarlo, quien lo puso; lo de los
 * demás se denuncia.
 */
export default function GameManualLinks({
  game,
  currentUserId,
  onChange,
}: {
  game: ManualGame;
  currentUserId: string;
  onChange: (manual: { manualUrl: string | null; manualAddedById: string | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const mine = !!game.manualUrl && game.manualAddedById === currentUserId;

  const startEditing = () => {
    setValue(game.manualUrl ?? "");
    setError("");
    setEditing(true);
  };

  const save = async () => {
    const check = checkManualUrl(value);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/games/${game.id}/manual`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onChange({ manualUrl: data.manualUrl, manualAddedById: data.manualAddedById });
        setEditing(false);
      } else {
        setError(data.error || "No se ha podido guardar el enlace");
      }
    } catch {
      setError("No se ha podido conectar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("¿Quitar el enlace al manual? Dejará de verse en todos los eventos y grupos.")) return;
    const res = await fetch(`/api/games/${game.id}/manual`, { method: "DELETE" });
    if (res.ok) onChange({ manualUrl: null, manualAddedById: null });
  };

  const linkClass = "text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors";
  const manualTitle = game.manualUrl ? manualTitleFromUrl(game.manualUrl) : null;
  const manualSource = game.manualUrl ? manualSourceLabel(game.manualUrl) : "";

  // A la derecha de la fila. El formulario se abre como un desplegable para
  // no descuadrarla.
  return (
    <div className="relative shrink-0 flex flex-col items-end pt-1 text-xs text-right">
      {game.manualUrl ? (
        <span className="inline-flex items-center gap-0.5">
          <a
            href={game.manualUrl}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            title={manualTitle ? `Manual: ${manualTitle}` : `Manual en ${manualSource || "la web"}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20 hover:border-[var(--primary)]/60 transition-colors"
          >
            📖 Manual
            {manualSource && (
              <span className="hidden sm:inline font-normal opacity-70">· {manualSource}</span>
            )}
          </a>
          <MoreMenu
            label="Opciones del manual"
            className="-mr-2"
            items={
              mine
                ? [
                    { label: "✏️ Cambiar enlace", onClick: startEditing },
                    { label: "🗑 Quitar enlace", onClick: remove, danger: true },
                  ]
                : [{ label: "🚩 Denunciar enlace", onClick: () => setReporting(true), danger: true }]
            }
          />
        </span>
      ) : (
        <button type="button" onClick={editing ? () => setEditing(false) : startEditing} className={linkClass}>
          ＋ <span className="sm:hidden">Manual</span>
          <span className="hidden sm:inline">Enlazar manual</span>
        </button>
      )}

      {editing && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-80 max-w-[calc(100vw-3rem)] p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg text-left">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving) save();
            }}
          >
            <input
              type="url"
              inputMode="url"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              placeholder="Enlace al manual (BGG, Drive, Dropbox…)"
              disabled={saving}
              className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200"
            />
            <p className={`mt-1.5 text-[11px] leading-snug ${error ? "text-red-400" : "text-[var(--text-muted)]"}`}>
              {error ||
                "La página del reglamento en la pestaña «Files» del juego en BGG, o un enlace de Drive, Dropbox o la editorial. No vale el de descarga de BGG, que caduca. Servirá a todo el que tenga este juego."}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-2.5 py-1 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !value.trim()}
                className="px-3 py-1 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-xs font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all duration-200"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reporting && <ReportModal targetType="game_manual" targetId={game.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
