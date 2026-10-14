"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { formatDateFull, formatRelativeTime } from "@/lib/format";
import { REPORT_TARGET_LABELS, reportReasonLabel, type ReportTargetType } from "@/lib/reports";

interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  href: string;
}

interface QueueItem {
  reportId: string;
  targetType: ReportTargetType;
  targetId: string;
  target: {
    preview: string | null;
    imageUrl: string | null;
    href: string | null;
    context: string | null;
    gone: boolean;
  };
  author: Person | null;
  autoHidden: boolean;
  status: "pending" | "resolved" | "dismissed";
  resolvedAt: string | null;
  resolvedBy: Person | null;
  reports: { id: string; reason: string; text: string | null; createdAt: string; reporter: Person | null }[];
}

type Action = "remove" | "resolve" | "dismiss";
type Tab = "pending" | "closed" | "bans";

interface Ban {
  email: string;
  name: string | null;
  reason: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<QueueItem["status"], string> = {
  pending: "Pendiente",
  resolved: "Resuelta",
  dismissed: "Descartada",
};

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [bans, setBans] = useState<Ban[] | null>(null);
  const [expelling, setExpelling] = useState<QueueItem | null>(null);
  const [removeContent, setRemoveContent] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  };

  const load = useCallback((status: Tab) => {
    if (status === "bans") {
      fetch("/api/admin/bans")
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data) => setBans(data.bans))
        .catch(() => setError("No se pudo cargar la lista de expulsados"));
      return;
    }
    fetch(`/api/admin/reports?status=${status}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setItems(data.items);
        setPendingCount(data.pendingCount);
      })
      .catch(() => setError("No se pudieron cargar las denuncias"));
  }, []);

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  const act = async (item: QueueItem, action: Action) => {
    if (action === "remove" && !confirm(`¿Retirar ${REPORT_TARGET_LABELS[item.targetType].this}? Desaparece para todo el mundo.`)) return;
    setBusy(item.reportId);
    try {
      const res = await fetch(`/api/admin/reports/${item.reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo resolver");
      setItems((prev) => (prev ?? []).filter((i) => i.reportId !== item.reportId));
      setPendingCount((n) => Math.max(0, n - item.reports.length));
      showToast(action === "remove" ? "Contenido retirado 🧹" : action === "dismiss" ? "Denuncia descartada" : "Denuncia resuelta");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo resolver");
    } finally {
      setBusy(null);
    }
  };

  const expel = async () => {
    const item = expelling;
    if (!item) return;
    setBusy(item.reportId);
    try {
      const res = await fetch(`/api/admin/reports/${item.reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expel", removeContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo expulsar");
      setExpelling(null);
      // Se cierran también las demás denuncias contra esa persona: se recarga.
      load("pending");
      showToast(`${item.author?.name ?? "Usuario"} expulsado 🚪`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo expulsar");
    } finally {
      setBusy(null);
    }
  };

  const readmit = async (ban: Ban) => {
    if (!confirm(`¿Readmitir a ${ban.name || ban.email}? Podrá volver a crear una cuenta con ${ban.email}, empezando de cero.`)) return;
    setBusy(ban.email);
    try {
      const res = await fetch("/api/admin/bans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ban.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo readmitir");
      setBans((prev) => (prev ?? []).filter((b) => b.email !== ban.email));
      showToast("Readmitido");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo readmitir");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-display font-semibold">Denuncias</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Lo que han denunciado los usuarios, agrupado por contenido. Hilos y respuestas con 3 denuncias o más
          se ocultan solos hasta que los revises.
        </p>
      </header>

      <div className="flex gap-2">
        {(["pending", "closed", "bans"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              if (t === tab) return;
              setItems(null);
              setBans(null);
              setError("");
              setTab(t);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              tab === t
                ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            {t === "pending" ? `Pendientes${pendingCount ? ` (${pendingCount})` : ""}` : t === "closed" ? "Revisadas" : "Expulsados"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-[var(--text-secondary)]">{error}</p>
      ) : tab === "bans" ? (
        bans === null ? (
          <p className="text-sm text-[var(--text-muted)]">Cargando expulsados…</p>
        ) : bans.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--border)]">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-sm text-[var(--text-secondary)]">Nadie expulsado. Que siga así.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {bans.map((ban) => (
              <li
                key={ban.email}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-[var(--text)] break-all">
                    {ban.name ? `${ban.name} · ` : ""}
                    {ban.email}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {ban.reason && `${ban.reason} · `}
                    <time dateTime={ban.createdAt} title={formatDateFull(ban.createdAt)}>
                      {formatRelativeTime(ban.createdAt)}
                    </time>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => readmit(ban)}
                  disabled={busy === ban.email}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                >
                  Readmitir
                </button>
              </li>
            ))}
          </ul>
        )
      ) : items === null ? (
        <p className="text-sm text-[var(--text-muted)]">Cargando denuncias…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--border)]">
          <p className="text-4xl mb-3">🕊️</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {tab === "pending" ? "No hay denuncias pendientes. Todo en calma." : "Aún no se ha revisado ninguna denuncia."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const label = REPORT_TARGET_LABELS[item.targetType];
            const isUser = item.targetType === "user";
            return (
              <li
                key={item.reportId}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--card-shadow)]"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                  <span className="px-2 py-0.5 rounded-full font-semibold bg-rose-500/10 text-rose-500">
                    🚩 {item.reports.length} denuncia{item.reports.length === 1 ? "" : "s"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    {label.noun}
                  </span>
                  {item.autoHidden && (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Oculto hasta que lo revises
                    </span>
                  )}
                  {item.target.gone && (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--surface-hover)] text-[var(--text-muted)]">
                      Ya no está publicado
                    </span>
                  )}
                  {item.status !== "pending" && (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--surface-hover)] text-[var(--text-muted)]">
                      {STATUS_LABEL[item.status]}
                      {item.resolvedBy && ` por ${item.resolvedBy.name}`}
                      {item.resolvedAt && ` · ${formatRelativeTime(item.resolvedAt)}`}
                    </span>
                  )}
                </div>

                {/* Lo denunciado */}
                <div className="flex gap-3 rounded-xl bg-[var(--surface-alt)] p-3 mb-3">
                  {item.target.imageUrl && (
                    <a
                      href={item.target.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden"
                    >
                      <Image src={item.target.imageUrl} alt="Foto denunciada" fill unoptimized className="object-cover" sizes="96px" />
                    </a>
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    {item.author && (
                      <Link href={item.author.href} className="inline-flex items-center gap-2 font-medium hover:text-purple-500 mb-1">
                        <Avatar name={item.author.name} avatarUrl={item.author.avatarUrl} size="xs" />
                        {item.author.name}
                      </Link>
                    )}
                    {item.target.context && <p className="text-xs text-[var(--text-muted)] mb-1">{item.target.context}</p>}
                    {item.target.preview ? (
                      <p className="whitespace-pre-wrap break-words text-[var(--text)] line-clamp-6">{item.target.preview}</p>
                    ) : (
                      !item.target.imageUrl && <p className="italic text-[var(--text-muted)]">Sin texto</p>
                    )}
                    {item.target.href && !item.target.gone && (
                      <Link
                        href={item.target.href}
                        target="_blank"
                        className="inline-block mt-2 text-xs font-medium text-purple-600 dark:text-purple-300 hover:underline"
                      >
                        Ver en su sitio ↗
                      </Link>
                    )}
                  </div>
                </div>

                {/* Quién y por qué */}
                <ul className="space-y-1.5 mb-4">
                  {item.reports.map((r) => (
                    <li key={r.id} className="text-sm text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--text)]">{reportReasonLabel(r.reason)}</span>
                      {" · "}
                      {r.reporter ? (
                        <Link href={r.reporter.href} className="hover:text-purple-500">
                          {r.reporter.name}
                        </Link>
                      ) : (
                        "Cuenta borrada"
                      )}
                      {" · "}
                      <time dateTime={r.createdAt} title={formatDateFull(r.createdAt)} className="text-xs text-[var(--text-muted)]">
                        {formatRelativeTime(r.createdAt)}
                      </time>
                      {r.text && <p className="mt-0.5 pl-3 border-l-2 border-[var(--border)] whitespace-pre-wrap break-words">{r.text}</p>}
                    </li>
                  ))}
                </ul>

                {item.status === "pending" && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.author && (
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveContent(true);
                          setExpelling(item);
                        }}
                        disabled={busy === item.reportId}
                        className="mr-auto px-4 py-2 rounded-xl text-sm font-medium border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      >
                        🚪 Expulsar a {item.author.name}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => act(item, "dismiss")}
                      disabled={busy === item.reportId}
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                    >
                      Descartar
                    </button>
                    {isUser || item.target.gone ? (
                      <button
                        type="button"
                        onClick={() => act(item, "resolve")}
                        disabled={busy === item.reportId}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
                      >
                        Marcar como resuelta
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => act(item, "remove")}
                        disabled={busy === item.reportId}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-50"
                      >
                        {busy === item.reportId ? "…" : "Retirar contenido"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {expelling?.author && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => busy !== expelling.reportId && setExpelling(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">¿Expulsar a {expelling.author.name}?</h3>
            <ul className="space-y-1.5 text-sm text-[var(--text-secondary)] leading-relaxed list-disc list-inside mb-4">
              {expelling.targetType !== "user" && <li>Se retira {REPORT_TARGET_LABELS[expelling.targetType].this}.</li>}
              <li>Se borra su cuenta y se cierran todas las denuncias contra esta persona.</li>
              <li>Su email no podrá volver a entrar. Le avisamos por email.</li>
              <li>Sus grupos y eventos pasan a otro miembro, como al borrar una cuenta.</li>
            </ul>
            <label className="flex items-start gap-2.5 text-sm mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={removeContent}
                onChange={(e) => setRemoveContent(e.target.checked)}
                className="mt-0.5 accent-rose-500"
              />
              <span>
                Retirar también todos sus mensajes de la Comunidad y sus fotos
                <span className="block text-xs text-[var(--text-muted)]">
                  Si no, se quedan como «Usuario eliminado». Sus opiniones y comentarios se quedan así siempre.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpelling(null)}
                disabled={busy === expelling.reportId}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={expel}
                disabled={busy === expelling.reportId}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-50"
              >
                {busy === expelling.reportId ? "Expulsando…" : "Expulsar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] shadow-lg rounded-xl px-4 py-2.5 text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
