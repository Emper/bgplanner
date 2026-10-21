"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { formatDateFull, formatRelativeTime } from "@/lib/format";
import { REPORT_TARGET_LABELS, reportReasonLabel, type ReportTargetType } from "@/lib/reports";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineLoading } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { AdminChip, AdminHeader } from "../AdminUI";

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
  const toast = useToast();
  const confirm = useConfirm();

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
    if (
      action === "remove" &&
      !(await confirm({
        title: `¿Retirar ${REPORT_TARGET_LABELS[item.targetType].this}?`,
        body: "Desaparece para todo el mundo.",
        confirmLabel: "Retirar",
        tone: "danger",
      }))
    )
      return;
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
      toast(action === "remove" ? "Contenido retirado 🧹" : action === "dismiss" ? "Denuncia descartada" : "Denuncia resuelta");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver");
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
      toast(`${item.author?.name ?? "Usuario"} expulsado 🚪`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo expulsar");
    } finally {
      setBusy(null);
    }
  };

  const readmit = async (ban: Ban) => {
    if (
      !(await confirm({
        title: `¿Readmitir a ${ban.name || ban.email}?`,
        body: `Podrá volver a crear una cuenta con ${ban.email}, empezando de cero.`,
        confirmLabel: "Readmitir",
      }))
    )
      return;
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
      toast("Readmitido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo readmitir");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Denuncias"
        lead="Lo que han denunciado los usuarios, agrupado por contenido. Hilos y respuestas con 3 denuncias o más se ocultan solos hasta que los revises."
      />

      <div className="flex flex-wrap gap-2">
        {(["pending", "closed", "bans"] as const).map((t) => (
          <AdminChip
            key={t}
            active={tab === t}
            count={t === "pending" && pendingCount ? pendingCount : undefined}
            onClick={() => {
              if (t === tab) return;
              setItems(null);
              setBans(null);
              setError("");
              setTab(t);
            }}
          >
            {t === "pending" ? "Pendientes" : t === "closed" ? "Revisadas" : "Expulsados"}
          </AdminChip>
        ))}
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : tab === "bans" ? (
        bans === null ? (
          <InlineLoading text="Cargando expulsados…" />
        ) : bans.length === 0 ? (
          <EmptyState variant="dashed" icon="🤝" title="Nadie expulsado. Que siga así." />
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
                <Button variant="secondary" onClick={() => readmit(ban)} loading={busy === ban.email}>
                  Readmitir
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : items === null ? (
        <InlineLoading text="Cargando denuncias…" />
      ) : items.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon="🕊️"
          title={tab === "pending" ? "No hay denuncias pendientes. Todo en calma." : "Aún no se ha revisado ninguna denuncia."}
        />
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
                  <span className="px-2 py-0.5 rounded-full font-semibold bg-[var(--danger-soft)] text-[var(--danger)]">
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
                      <Button
                        variant="dangerOutline"
                        onClick={() => {
                          setRemoveContent(true);
                          setExpelling(item);
                        }}
                        disabled={busy === item.reportId}
                        className="mr-auto"
                      >
                        🚪 Expulsar a {item.author.name}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => act(item, "dismiss")} disabled={busy === item.reportId}>
                      Descartar
                    </Button>
                    {isUser || item.target.gone ? (
                      <Button onClick={() => act(item, "resolve")} loading={busy === item.reportId}>
                        Marcar como resuelta
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={() => act(item, "remove")} loading={busy === item.reportId}>
                        Retirar contenido
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!expelling?.author}
        onClose={() => setExpelling(null)}
        tone="danger"
        title={expelling?.author ? `¿Expulsar a ${expelling.author.name}?` : undefined}
        busy={!!expelling && busy === expelling.reportId}
        footer={
          <>
            <Button variant="secondary" onClick={() => setExpelling(null)} disabled={!!expelling && busy === expelling.reportId}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={expel} loading={!!expelling && busy === expelling.reportId}>
              {expelling && busy === expelling.reportId ? "Expulsando…" : "Expulsar"}
            </Button>
          </>
        }
      >
        {expelling && (
          <>
            <ul className="space-y-1.5 text-sm text-[var(--text-secondary)] leading-relaxed list-disc list-inside mb-4">
              {expelling.targetType !== "user" && <li>Se retira {REPORT_TARGET_LABELS[expelling.targetType].this}.</li>}
              <li>Se borra su cuenta y se cierran todas las denuncias contra esta persona.</li>
              <li>Su email no podrá volver a entrar. Le avisamos por email.</li>
              <li>Sus grupos y eventos pasan a otro miembro, como al borrar una cuenta.</li>
            </ul>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={removeContent}
                onChange={(e) => setRemoveContent(e.target.checked)}
                className="mt-0.5 accent-red-600"
              />
              <span>
                Retirar también todos sus mensajes de la Comunidad y sus fotos
                <span className="block text-xs text-[var(--text-muted)]">
                  Si no, se quedan como «Usuario eliminado». Sus opiniones y comentarios se quedan así siempre.
                </span>
              </span>
            </label>
          </>
        )}
      </Modal>
    </div>
  );
}
