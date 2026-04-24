"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

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
    upVotes: number;
    superVotes: number;
    downVotes: number;
    playCount: number;
  }[];
  votes: {
    id: string;
    value: number;
    createdAt: string;
    gameName: string;
    user: { id: string; name: string; email: string };
  }[];
  sessions: {
    id: string;
    name: string | null;
    date: string;
    status: string;
    playerCount: number;
    totalMinutes: number;
    createdBy: string;
    games: { name: string; status: string }[];
  }[];
}

function voteLabel(value: number): { text: string; color: string } {
  if (value >= 3) return { text: "🔥 super", color: "text-amber-600 dark:text-amber-400" };
  if (value > 0) return { text: "👍 a favor", color: "text-emerald-600 dark:text-emerald-400" };
  return { text: "👎 en contra", color: "text-rose-600 dark:text-rose-400" };
}

export default function AdminGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<AdminGroupDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");

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
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!data || deleteText !== data.name) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/admin/groups");
    } catch {
      setError("No se pudo eliminar");
      setSaving(false);
    }
  }

  if (error) return <div className="text-sm text-[var(--color-danger,#ef4444)]">{error}</div>;
  if (!data) return <div className="text-sm text-[var(--text-muted)]">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="text-xs text-[var(--text-muted)]">
        <Link href="/admin/groups" className="hover:text-purple-600">← Todos los grupos</Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {editing ? (
            <div className="flex gap-2 items-center">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="px-3 py-2 rounded-xl text-base bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none font-display"
              />
              <button
                onClick={saveName}
                disabled={saving}
                className="px-3 py-2 rounded-xl text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                onClick={() => { setEditing(false); setEditName(data.name); }}
                className="px-3 py-2 rounded-xl text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <h1 className="text-2xl font-display font-semibold">{data.name}</h1>
          )}
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Creado por <span className="font-medium">{data.owner.displayName || data.owner.name || data.owner.email}</span> · {new Date(data.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} · {data.type}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-2 rounded-xl text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]"
            >
              Editar nombre
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-xl text-sm border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            >
              Eliminar grupo
            </button>
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Miembros ({data.members.length})</h2>
          <ul className="divide-y divide-[var(--border)]">
            {data.members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.user.name}</div>
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
                  <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
                    {r.score} pts · {r.superVotes}🔥 {r.upVotes}👍 {r.downVotes}👎
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
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Sesiones ({data.sessions.length})</h2>
        {data.sessions.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin sesiones registradas.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.sessions.slice(0, 20).map((s) => (
              <li key={s.id} className="py-2 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {s.name || `Sesión del ${new Date(s.date).toLocaleDateString("es-ES")}`}{" "}
                    <span className="text-xs text-[var(--text-muted)] font-normal">· {s.status}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {s.games.map((g) => g.name).join(", ") || "Sin juegos"}
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {new Date(s.date).toLocaleDateString("es-ES")} · {s.playerCount}p · {s.totalMinutes}m
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
                const label = voteLabel(v.value);
                return (
                  <li key={v.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{v.user.name}</span>{" "}
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

      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && setConfirmDelete(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-semibold mb-2">Eliminar grupo</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Esta acción es irreversible. Se borrarán todos los juegos, votos, sesiones y miembros.
              Escribe <span className="font-mono font-semibold">{data.name}</span> para confirmar.
            </p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-rose-500 focus:outline-none mb-4"
              placeholder={data.name}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
                className="px-3 py-2 rounded-xl text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]"
              >
                Cancelar
              </button>
              <button
                onClick={deleteGroup}
                disabled={saving || deleteText !== data.name}
                className="px-3 py-2 rounded-xl text-sm bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
