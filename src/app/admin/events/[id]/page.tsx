"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { formatActivity } from "@/lib/activityFormat";
import { formatDateFull, toDateTimeLocalInput } from "@/lib/format";
import { isVeto } from "@/lib/intensity";
import { displayName } from "@/lib/users";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, FieldError, Input, Select, Textarea } from "@/components/ui/Field";
import { InlineLoading } from "@/components/ui/Spinner";
import { BackLink } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { AdminHeader } from "../../AdminUI";

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

export default function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
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
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((d: AdminEventDetail) => {
        setData(d);
        setForm({
          name: d.name,
          description: d.description || "",
          date: toDateTimeLocalInput(d.date),
          endDate: toDateTimeLocalInput(d.endDate),
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
    setFormError("");
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
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
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
      toast.error("No se pudo eliminar");
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin/events">Todos los eventos</BackLink>
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!data) return <InlineLoading />;

  const attending = data.attendees.filter((a) => a.status === "attending");
  const maybe = data.attendees.filter((a) => a.status === "maybe");
  const cancelled = data.attendees.filter((a) => a.status === "cancelled");

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/events", label: "Todos los eventos" }}
        title={data.name}
        badge={
          data.visibility === "private" && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
              Privado
            </span>
          )
        }
        lead={
          <>
            Creado por <span className="font-medium">{displayName(data.createdBy, data.createdBy.email)}</span> ·{" "}
            {new Date(data.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
          </>
        }
        action={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setFormError("");
                setEditing(true);
              }}
            >
              Editar evento
            </Button>
            <Button variant="dangerOutline" onClick={() => setConfirmDelete(true)}>
              Eliminar evento
            </Button>
          </>
        }
      />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-1 text-sm">
        <div><span className="text-[var(--text-muted)] uppercase tracking-wide text-xs">Cuándo:</span> {formatDateFull(data.date)}{data.endDate && ` → ${formatDateFull(data.endDate)}`}</div>
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
                    <div className="font-medium truncate">{displayName(a.user, a.user.email)}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{a.user.email}</div>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{new Date(a.joinedAt).toLocaleDateString("es-ES")}</span>
                </li>
              ))}
            </ul>
          )}
          {(maybe.length > 0 || cancelled.length > 0) && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              {maybe.length > 0 && <div>Tal vez: {maybe.map((a) => displayName(a.user, a.user.email)).join(", ")}</div>}
              {cancelled.length > 0 && <div>Cancelaron: {cancelled.map((a) => displayName(a.user, a.user.email)).join(", ")}</div>}
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
                const vetoes = g.interests.filter((i) => isVeto(i.intensity)).length;
                return (
                  <li key={g.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{g.gameName}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">por {g.addedBy}</div>
                    </div>
                    <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      {g.interests.length - vetoes} interés · {total} pts{vetoes > 0 ? ` · ${vetoes} veto${vetoes !== 1 ? "s" : ""}` : ""}
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

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar evento"
        size="lg"
        busy={saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveEvent} loading={saving} disabled={!form.name.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre">
            {(fieldId) => <Input id={fieldId} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="Descripción">
            {(fieldId) => (
              <Textarea
                id={fieldId}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio">
              {(fieldId) => (
                <Input
                  id={fieldId}
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              )}
            </Field>
            <Field label="Fin (opcional)">
              {(fieldId) => (
                <Input
                  id={fieldId}
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              )}
            </Field>
          </div>
          <Field label="Lugar">
            {(fieldId) => (
              <Input id={fieldId} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Aforo">
              {(fieldId) => (
                <Input
                  id={fieldId}
                  type="number"
                  min={1}
                  value={form.maxAttendees}
                  onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
                />
              )}
            </Field>
            <Field label="Visibilidad">
              {(fieldId) => (
                <Select
                  id={fieldId}
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value as "public" | "private" })}
                >
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </Select>
              )}
            </Field>
          </div>
          <FieldError>{formError}</FieldError>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title="Eliminar evento"
        body="Esta acción es irreversible. Se borrarán asistentes, juegos propuestos y actividad asociada."
        confirmLabel={saving ? "Eliminando…" : "Eliminar"}
        busy={saving}
        onConfirm={deleteEvent}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
