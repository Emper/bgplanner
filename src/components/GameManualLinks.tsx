"use client";

import { useState } from "react";
import { MoreMenu, ReportModal } from "@/components/Moderation";
import { checkManualUrl, manualSourceLabel, manualTitleFromUrl } from "@/lib/bggLinks";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

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
  const confirm = useConfirm();
  const toast = useToast();
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
    const ok = await confirm({
      title: "¿Quitar el enlace al manual?",
      body: "Dejará de verse en todos los eventos y grupos.",
      confirmLabel: "Quitar",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/games/${game.id}/manual`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onChange({ manualUrl: null, manualAddedById: null });
    else toast.error("No se ha podido quitar el enlace");
  };

  const linkClass = "text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors";
  const manualTitle = game.manualUrl ? manualTitleFromUrl(game.manualUrl) : null;
  const manualSource = game.manualUrl ? manualSourceLabel(game.manualUrl) : "";

  // A la derecha de la fila. El formulario se abre como un desplegable para
  // no descuadrarla.
  return (
    <div className="relative shrink-0 self-center flex flex-col items-end text-xs text-right">
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
            <Input
              size="sm"
              type="url"
              inputMode="url"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              placeholder="Enlace al manual (BGG, Drive, Dropbox…)"
              disabled={saving}
              tone={error ? "danger" : "default"}
            />
            <p className={`mt-1.5 text-[11px] leading-snug ${error ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
              {error ||
                "La página del reglamento en la pestaña «Files» del juego en BGG, o un enlace de Drive, Dropbox o la editorial. No vale el de descarga de BGG, que caduca. Servirá a todo el que tenga este juego."}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="xs" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="xs" disabled={!value.trim()} loading={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {reporting && <ReportModal targetType="game_manual" targetId={game.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
