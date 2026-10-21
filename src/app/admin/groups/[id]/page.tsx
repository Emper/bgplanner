"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { findVoteOption } from "@/lib/groupTypes";
import { displayName } from "@/lib/users";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { InlineLoading } from "@/components/ui/Spinner";
import { BackLink } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { AdminHeader } from "../../AdminUI";

interface AdminGroupDetail {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  inviteEnabled: boolean;
  owner: { id: string; name: string | null; displayName: string | null; email: string; avatarUrl: string | null };
  members: {
    id: string;
    role: string;
    joinedAt: string;
    pinned: boolean;
    lastPingedAt: string | null;
    user: { id: string; name: string; email: string; avatarUrl: string | null; bggUsername: string | null };
  }[];
  ranking: {
    groupGameId: string;
    gameId: string;
    gameName: string;
    thumbnail: string | null;
    score: number;
    playCount: number;
    breakdown: { value: number; count: number }[];
  }[];
  votes: {
    id: string;
    value: number;
    createdAt: string;
    groupGameId: string;
    gameName: string;
    user: { id: string; name: string; email: string };
  }[];
  nights: {
    id: string;
    date: string;
    playerCount: number;
    createdBy: string;
    games: string[];
  }[];
}

function voteLabel(typeId: string, value: number): { text: string; color: string } {
  const opt = findVoteOption(typeId, value);
  const sign = value > 0 ? "+" : "";
  if (opt) {
    const text = `${opt.emoji} ${opt.label} (${sign}${value})`;
    if (opt.tone === "super") return { text, color: "text-amber-600 dark:text-amber-400" };
    if (opt.tone === "negative") return { text, color: "text-rose-600 dark:text-rose-400" };
    if (opt.tone === "positive") return { text, color: "text-emerald-600 dark:text-emerald-400" };
    return { text, color: "text-[var(--text-secondary)]" };
  }
  return { text: `${sign}${value}`, color: "text-[var(--text-secondary)]" };
}

export default function AdminGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<AdminGroupDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/groups/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((d) => {
        setData(d);
        setEditName(d.name);
      })
      .catch(() => setError("No se pudo cargar el grupo"));
  }, [id]);

  async function saveName() {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error();
      setData((d) => (d ? { ...d, name: editName.trim() } : d));
      setEditing(false);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/admin/groups");
    } catch {
      toast.error("No se pudo eliminar");
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin/groups">Todos los grupos</BackLink>
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!data) return <InlineLoading />;

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/groups", label: "Todos los grupos" }}
        title={data.name}
        lead={
          <>
            Creado por <span className="font-medium">{displayName(data.owner, data.owner.email)}</span> ·{" "}
            {new Date(data.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} ·{" "}
            {data.type}
          </>
        }
        action={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditName(data.name);
                setEditing(true);
              }}
            >
              Editar nombre
            </Button>
            <Button variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
              Eliminar grupo
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Miembros ({data.members.length})</h2>
          <ul className="divide-y divide-[var(--border)]">
            {data.members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{displayName(m.user, m.user.email)}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{m.user.email}</div>
                </div>
                <div className="text-right">
                  <span className={`text-xs uppercase tracking-wide font-medium ${m.role === "owner" ? "text-purple-600 dark:text-purple-300" : m.role === "admin" ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-muted)]"}`}>{m.role}</span>
                  <div className="text-xs text-[var(--text-muted)]">{new Date(m.joinedAt).toLocaleDateString("es-ES")}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Ranking ({data.ranking.length} juegos)</h2>
          {data.ranking.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin juegos.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.ranking.slice(0, 15).map((r, i) => (
                <li key={r.groupGameId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[var(--text-muted)] w-5 text-right">{i + 1}</span>
                    <span className="truncate">{r.gameName}</span>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap flex items-center gap-1.5">
                    <span>{r.score} pts</span>
                    {r.breakdown.length > 0 && <span className="text-[var(--text-muted)]">·</span>}
                    {r.breakdown.map((b) => {
                      const opt = findVoteOption(data.type, b.value);
                      return (
                        <span
                          key={b.value}
                          title={opt ? `${opt.label} (${b.value > 0 ? "+" : ""}${b.value})` : `${b.value}`}
                        >
                          {b.count}{opt?.emoji || (b.value > 0 ? "👍" : "👎")}
                        </span>
                      );
                    })}
                  </span>
                </li>
              ))}
              {data.ranking.length > 15 && (
                <li className="text-xs text-[var(--text-muted)] italic">+{data.ranking.length - 15} más</li>
              )}
            </ol>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Sesiones ({data.nights.length})</h2>
        {data.nights.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin sesiones registradas.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.nights.slice(0, 20).map((n) => (
              <li key={n.id} className="py-2 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    Sesión del {new Date(n.date).toLocaleDateString("es-ES")}{" "}
                    <span className="text-xs text-[var(--text-muted)] font-normal">· {n.createdBy}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {n.games.join(", ") || "Sin juegos"}
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {n.playerCount}p · {n.games.length} {n.games.length === 1 ? "juego" : "juegos"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Votos ({data.votes.length})</h2>
        {data.votes.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin votos.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <ul className="divide-y divide-[var(--border)] text-sm">
              {data.votes.map((v) => {
                const label = voteLabel(data.type, v.value);
                return (
                  <li key={v.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{displayName(v.user, v.user.email)}</span>{" "}
                      <span className={`text-xs ${label.color}`}>{label.text}</span>
                      <span className="text-[var(--text-secondary)]"> en </span>
                      <span className="font-medium">{v.gameName}</span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(v.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar nombre"
        busy={saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveName} loading={saving} disabled={!editName.trim()}>
              Guardar
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <Field label="Nombre del grupo">
            {(fieldId) => <Input id={fieldId} value={editName} onChange={(e) => setEditName(e.target.value)} />}
          </Field>
        </form>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          open
          tone="danger"
          title="Eliminar grupo"
          body="Esta acción es irreversible. Se borrarán todos los juegos, votos, sesiones y miembros."
          requireText={data.name}
          confirmLabel={saving ? "Eliminando…" : "Eliminar definitivamente"}
          busy={saving}
          onConfirm={deleteGroup}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
