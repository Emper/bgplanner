"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  reporter: { id: string; name: string; email: string };
  target: {
    ownerId: string;
    ownerName: string;
    kindLabel: string;
    snippet: string;
    groupId: string | null;
    eventId: string | null;
  } | null;
}

const REASON_LABELS: Record<string, string> = {
  offensive: "Ofensivo o violento",
  sexual: "Sexual o inapropiado",
  harassment: "Acoso",
  spam: "Spam",
  other: "Otro",
};

const TYPE_LABELS: Record<string, string> = {
  photo: "Foto",
  review: "Opinión",
  comment: "Comentario",
  user: "Persona",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  actioned: "Resuelta",
  dismissed: "Descartada",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  actioned: "bg-emerald-500/15 text-emerald-500",
  dismissed: "bg-[var(--surface-hover)] text-[var(--text-muted)]",
};

type Filter = "pending" | "actioned" | "dismissed" | "all";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/reports?status=${filter}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports(data.reports);
    } catch {
      setError("No se pudieron cargar las denuncias");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === "pending").length,
    [reports]
  );

  const setStatus = async (id: string, status: string) => {
    setSaving(id);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo actualizar la denuncia");
        return;
      }
      if (filter !== "all" && filter !== status) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      } else {
        setReports((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status, reviewedAt: new Date().toISOString() }
              : r
          )
        );
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Denuncias</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {loading
              ? "Cargando…"
              : `${reports.length} denuncia${reports.length === 1 ? "" : "s"}${
                  filter === "all" && pendingCount > 0
                    ? ` · ${pendingCount} sin revisar`
                    : ""
                }`}
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="px-3 py-2 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none"
        >
          <option value="pending">Pendientes</option>
          <option value="actioned">Resueltas</option>
          <option value="dismissed">Descartadas</option>
          <option value="all">Todas</option>
        </select>
      </header>

      {error && <div className="text-sm text-[var(--color-danger,#ef4444)]">{error}</div>}

      {!loading && reports.length === 0 && !error && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-[var(--text-muted)]">
          No hay denuncias{filter === "pending" ? " pendientes" : ""}. 🎉
        </div>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                {TYPE_LABELS[r.targetType] || r.targetType}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-400">
                {REASON_LABELS[r.reason] || r.reason}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  STATUS_CLASSES[r.status] || STATUS_CLASSES.dismissed
                }`}
              >
                {STATUS_LABELS[r.status] || r.status}
              </span>
              <span className="ml-auto text-xs text-[var(--text-muted)] whitespace-nowrap">
                {fmtDate(r.createdAt)}
              </span>
            </div>

            {r.target ? (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">
                  {r.target.kindLabel} · de{" "}
                  <span className="text-[var(--text-secondary)] font-medium">
                    {r.target.ownerName}
                  </span>
                </p>
                <div className="rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--text)] whitespace-pre-wrap break-words">
                  {r.target.snippet}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic">
                El contenido denunciado ya no existe (id {r.targetId}).
              </p>
            )}

            {r.detail && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">
                  Comentario de quien denuncia
                </p>
                <div className="rounded-xl border-l-2 border-amber-500 bg-[var(--input-bg)] px-3 py-2 text-sm italic text-[var(--text)] whitespace-pre-wrap break-words">
                  {r.detail}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--text-muted)]">
                Denunciado por{" "}
                <span className="text-[var(--text-secondary)]">{r.reporter.name}</span>{" "}
                ({r.reporter.email})
                {r.reviewedAt && ` · revisada el ${fmtDate(r.reviewedAt)}`}
              </p>
              <div className="flex gap-2">
                {r.status !== "actioned" && (
                  <button
                    onClick={() => setStatus(r.id, "actioned")}
                    disabled={saving === r.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white disabled:opacity-50"
                  >
                    Marcar resuelta
                  </button>
                )}
                {r.status !== "dismissed" && (
                  <button
                    onClick={() => setStatus(r.id, "dismissed")}
                    disabled={saving === r.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-50"
                  >
                    Descartar
                  </button>
                )}
                {r.status !== "pending" && (
                  <button
                    onClick={() => setStatus(r.id, "pending")}
                    disabled={saving === r.id}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-muted)] disabled:opacity-50"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
