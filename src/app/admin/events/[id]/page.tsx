"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { formatActivity } from "@/lib/activity";

interface AdminEventDetail {
  id: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  visibility: "public" | "private";
  imageUrl: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; displayName: string | null; email: string };
  attendees: {
    id: string;
    status: string;
    joinedAt: string;
    user: { id: string; name: string; email: string };
  }[];
  games: {
    id: string;
    gameName: string;
    thumbnail: string | null;
    addedAt: string;
    addedBy: string;
    interests: { intensity: number; userName: string }[];
  }[];
  activity: {
    id: string;
    type: string;
    createdAt: string;
    userName: string;
    metadata: Record<string, unknown>;
  }[];
}

function toLocalInput(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<AdminEventDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    date: "",
    endDate: "",
    location: "",
    maxAttendees: "" as string | "",
    visibility: "public" as "public" | "private",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((d: AdminEventDetail) => {
        setData(d);
        setForm({
          name: d.name,
          description: d.description || "",
          date: toLocalInput(d.date),
          endDate: toLocalInput(d.endDate),
          location: d.location || "",
          maxAttendees: d.maxAttendees ? String(d.maxAttendees) : "",
          visibility: d.visibility,
        });
      })
      .catch(() => setError("No se pudo cargar el evento"));
  }, [id]);

  async function saveEvent() {
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description || null,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        location: form.location || null,
        maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
        visibility: form.visibility,
      };
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Error");
      }
      const updated = await res.json();
      setData((d) => (d ? { ...d, ...updated, createdBy: d.createdBy, attendees: d.attendees, games: d.games, activity: d.activity } : d));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/admin/events");
    } catch {
      setError("No se pudo eliminar");
      setSaving(false);
    }
  }

  if (error && !data) return <div className="text-sm text-[var(--color-danger,#ef4444)]">{error}</div>;
  if (!data) return <div className="text-sm text-[var(--text-muted)]">Cargando…</div>;

  const attending = data.attendees.filter((a) => a.status === "attending");
  const maybe = data.attendees.filter((a) => a.status === "maybe");
  const cancelled = data.attendees.filter((a) => a.status === "cancelled");

  return (
    <div className="space-y-6">
      <div className="text-xs text-[var(--text-muted)]">
        <Link href="/admin/events" className="hover:text-purple-600">← Todos los eventos</Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-display font-semibold">{data.name}</h1>
            {data.visibility === "private" && (
              <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
                Privado
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Creado por <span className="font-medium">{data.createdBy.displayName || data.createdBy.name || data.createdBy.email}</span> · {new Date(data.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-xl text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]"
          >
            Editar evento
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-xl text-sm border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
          >
            Eliminar evento
          </button>
        </div>
      </header>

      {error && data && (
        <div className="text-sm rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 px-3 py-2">{error}</div>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-1 text-sm">
        <div><span className="text-[var(--text-muted)] uppercase tracking-wide text-xs">Cuándo:</span> {new Date(data.date).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}{data.endDate && ` → ${new Date(data.endDate).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}`}</div>
        {data.location && <div><span className="text-[var(--text-muted)] uppercase tracking-wide text-xs">Dónde:</span> {data.location}</div>}
        {data.maxAttendees && <div><span className="text-[var(--text-muted)] uppercase tracking-wide text-xs">Aforo:</span> {data.maxAttendees}</div>}
        {data.description && <div className="whitespace-pre-wrap text-[var(--text-secondary)] mt-2">{data.description}</div>}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">
            Asistentes ({attending.length}{data.maxAttendees ? `/${data.maxAttendees}` : ""})
          </h2>
          {attending.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin asistentes confirmados.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {attending.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.user.name}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{a.user.email}</div>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{new Date(a.joinedAt).toLocaleDateString("es-ES")}</span>
                </li>
              ))}
            </ul>
          )}
          {(maybe.length > 0 || cancelled.length > 0) && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              {maybe.length > 0 && <div>Tal vez: {maybe.map((a) => a.user.name).join(", ")}</div>}
              {cancelled.length > 0 && <div>Cancelaron: {cancelled.map((a) => a.user.name).join(", ")}</div>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Juegos propuestos ({data.games.length})</h2>
          {data.games.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin juegos.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {data.games.map((g) => {
                const total = g.interests.reduce((s, i) => s + i.intensity, 0);
                return (
                  <li key={g.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{g.gameName}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">por {g.addedBy}</div>
                    </div>
                    <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      {g.interests.length} interés · {total} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Actividad ({data.activity.length})</h2>
        {data.activity.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Sin actividad registrada.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm max-h-96 overflow-y-auto">
            {data.activity.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{a.userName}</span>{" "}
                  <span className="text-[var(--text-secondary)]">{formatActivity(a.type, a.metadata)}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-semibold mb-4">Editar evento</h3>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Descripción</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none resize-none" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Inicio</span>
                  <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Fin (opcional)</span>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Lugar</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Aforo</span>
                  <input type="number" min={1} value={form.maxAttendees} onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Visibilidad</span>
                  <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "public" | "private" })} className="mt-1 w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none">
                    <option value="public">Público</option>
                    <option value="private">Privado</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setEditing(false)} disabled={saving} className="px-3 py-2 rounded-xl text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]">Cancelar</button>
              <button onClick={saveEvent} disabled={saving || !form.name.trim()} className="px-3 py-2 rounded-xl text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && setConfirmDelete(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-semibold mb-2">Eliminar evento</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Esta acción es irreversible. Se borrarán asistentes, juegos propuestos y actividad asociada.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} disabled={saving} className="px-3 py-2 rounded-xl text-sm border border-[var(--border)] hover:bg-[var(--surface-hover)]">Cancelar</button>
              <button onClick={deleteEvent} disabled={saving} className="px-3 py-2 rounded-xl text-sm bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
                {saving ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
