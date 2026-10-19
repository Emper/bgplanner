"use client";

import { useState } from "react";
import { MoreMenu, ReportModal } from "@/components/Moderation";
import { bggFilesUrl, checkManualUrl, manualSourceLabel, manualTitleFromUrl } from "@/lib/bggLinks";

export interface ManualGame {
  id: string;
  bggId: number;
  name: string;
  manualUrl: string | null;
  manualAddedById: string | null;
}

/**
 * Bajo un juego: «📄 Ficheros en BGG» siempre y, si alguien lo ha enlazado,
 * «📖 Manual» directo (en BGG, Drive, Dropbox…). Si no hay, cualquiera puede
 * enlazarlo; cambiarlo o quitarlo, quien lo puso. Lo de los demás se denuncia.
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

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {game.manualUrl ? (
          <span className="inline-flex items-center gap-0.5">
            <a
              href={game.manualUrl}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              title={manualTitle ? `Manual: ${manualTitle}` : `Manual en ${manualSource || "la web"}`}
              className="font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
            >
              📖 Manual
              {manualSource && <span className="font-normal text-[var(--text-muted)]"> · {manualSource}</span>}
            </a>
            <MoreMenu
              label="Opciones del manual"
              align="left"
              className="-my-1.5"
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
          !editing && (
            <button type="button" onClick={startEditing} className={linkClass}>
              ＋ Enlazar manual
            </button>
          )
        )}
        <a
          href={bggFilesUrl(game.bggId, game.name)}
          target="_blank"
          rel="noopener noreferrer"
          title="Reglas, ayudas y traducciones que ha subido la gente a BGG"
          className={linkClass}
        >
          📄 Ficheros en BGG
        </a>
      </div>

      {editing && (
        <div className="mt-1.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving) save();
            }}
            className="flex gap-2"
          >
            <input
              type="url"
              inputMode="url"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enlace al manual (BGG, Drive, Dropbox…)"
              disabled={saving}
              className="flex-1 min-w-0 px-2 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200"
            />
            <button
              type="submit"
              disabled={saving || !value.trim()}
              className="px-3 py-1 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-xs font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all duration-200"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1 rounded-xl text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancelar
            </button>
          </form>
          <p className={`mt-1 text-[11px] ${error ? "text-red-400" : "text-[var(--text-muted)]"}`}>
            {error ||
              "La página del reglamento en «Ficheros en BGG», o un enlace de Drive, Dropbox o la editorial. No vale el de descarga de BGG, que caduca. Servirá a todo el que tenga este juego."}
          </p>
        </div>
      )}

      {reporting && <ReportModal targetType="game_manual" targetId={game.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
