"use client";

import { useState } from "react";
import FriendButton from "./FriendButton";
import { BlockModal, MoreMenu, ReportModal, unblockUser } from "./Moderation";
import type { Friend } from "@/lib/friends";

/**
 * Lo que puedes hacer en el perfil de otro: añadirle a amigos y, en el «⋯»,
 * denunciarle o bloquearle. Bloqueado, el botón de amigos deja sitio al
 * aviso para desbloquear.
 */
export default function ProfileActions({
  user,
  addedViewer,
  initialBlocked,
}: {
  user: Friend;
  /** Te tiene entre sus amigos. */
  addedViewer: boolean;
  initialBlocked: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = user.displayName || user.name || "este jugador";

  const unblock = async () => {
    setBusy(true);
    const ok = await unblockUser(user.id);
    setBusy(false);
    if (ok) setBlocked(false);
    else alert("No se ha podido desbloquear");
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {blocked ? (
        <span className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          🚫 Has bloqueado a {name}
          <button
            type="button"
            onClick={unblock}
            disabled={busy}
            className="px-3 py-1 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 transition-all duration-200 disabled:opacity-60"
          >
            {busy ? "…" : "Desbloquear"}
          </button>
        </span>
      ) : (
        <>
          <FriendButton variant="pill" user={user} />
          {addedViewer && <span className="text-xs text-[var(--text-muted)]">🤝 Te tiene entre sus amigos</span>}
        </>
      )}
      <MoreMenu
        className="ml-auto"
        label="Más opciones"
        items={[
          { label: "🚩 Denunciar perfil", onClick: () => setReporting(true) },
          ...(blocked ? [] : [{ label: `🚫 Bloquear a ${name}`, onClick: () => setBlocking(true), danger: true }]),
        ]}
      />

      {reporting && <ReportModal targetType="user" targetId={user.id} onClose={() => setReporting(false)} />}
      {blocking && (
        <BlockModal
          user={{ id: user.id, name }}
          onClose={() => setBlocking(false)}
          onBlocked={() => {
            setBlocking(false);
            setBlocked(true);
          }}
        />
      )}
    </div>
  );
}
