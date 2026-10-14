"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import EmojiField from "@/components/EmojiField";
import Avatar from "@/components/Avatar";
import {
  AuthorLink,
  ModerationNote,
  PostText,
  TagChip,
  type CommunityAuthor,
} from "@/components/CommunityBits";
import { BlockModal, MoreMenu, ReportModal, unblockUser, type MoreMenuItem } from "@/components/Moderation";
import { announceUnread } from "@/components/NotificationList";
import {
  COMMUNITY_TAGS,
  REPLY_BODY_MAX,
  THREAD_BODY_MAX,
  THREAD_TITLE_MAX,
  type CommunityTag,
} from "@/lib/community";
import { formatDateFull, formatRelativeTime } from "@/lib/format";
import { nudgePush } from "@/lib/pushNudge";

interface Thread {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  createdAt: string;
  editedAt: string | null;
  author: CommunityAuthor;
}

type Reply =
  // `hidden`: oculta por denuncias mientras se revisa
  | { id: string; deleted: true; hidden?: boolean; createdAt: string }
  | {
      id: string;
      deleted: false;
      body: string;
      createdAt: string;
      editedAt: string | null;
      author: CommunityAuthor;
    };

type PendingDelete = { kind: "thread" } | { kind: "reply"; id: string } | null;

const inputClass =
  "w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200";
const primaryBtn =
  "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-5 py-2 rounded-xl text-sm transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md";
const ghostBtn =
  "px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors";
const dangerBtn =
  "px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors";

function Timestamp({ createdAt, editedAt }: { createdAt: string; editedAt?: string | null }) {
  return (
    <span className="text-xs text-[var(--text-muted)]">
      <time dateTime={createdAt} title={formatDateFull(createdAt)}>
        {formatRelativeTime(createdAt)}
      </time>
      {editedAt && (
        <span title={`Editado ${formatDateFull(editedAt)}`}> · editado</span>
      )}
    </span>
  );
}

export interface ThreadInitial {
  thread: Thread;
  replies: Reply[];
}

// El hilo llega ya pintado del servidor (para buscadores y para quien no tiene
// cuenta); aquí solo vive lo interactivo: responder, editar, borrar, fijar.
export default function ThreadClient({
  initial,
  viewerId,
  isAdmin,
  initialBlockedIds = [],
  banner,
}: {
  initial: ThreadInitial;
  viewerId: string | null;
  isAdmin: boolean;
  /** A quién ha bloqueado quien mira: sus mensajes salen plegados. */
  initialBlockedIds?: string[];
  /** Lo que va arriba del todo (la invitación a registrarse, sin sesión). */
  banner?: React.ReactNode;
}) {
  const router = useRouter();

  const [thread, setThread] = useState<Thread>(initial.thread);
  const [replies, setReplies] = useState<Reply[]>(initial.replies);
  const [toast, setToast] = useState("");

  // Edición del hilo
  const [editingThread, setEditingThread] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTag, setDraftTag] = useState<CommunityTag | "">("");
  const [savingThread, setSavingThread] = useState(false);

  // Edición de una respuesta
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Respuesta nueva
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");

  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);

  // Moderación: denunciar, bloquear y los mensajes de bloqueados que se han
  // desplegado a mano
  const [blockedIds, setBlockedIds] = useState<string[]>(initialBlockedIds);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState<{ type: "thread" | "reply"; id: string } | null>(null);
  const [blocking, setBlocking] = useState<CommunityAuthor | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4000);
  }, []);

  // Abrir el hilo da por vistos sus avisos de respuestas; la campana se pone
  // al día con lo que devuelva.
  const threadId = initial.thread.id;
  useEffect(() => {
    if (!viewerId) return;
    fetch(`/api/community/${threadId}/seen`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (typeof data?.unread === "number") announceUnread(data.unread);
      })
      .catch(() => {});
  }, [threadId, viewerId]);

  // Al llegar desde un aviso (#reply-…) se lleva la respuesta a la vista y se
  // resalta un momento (con `data-highlight`, que pinta las clases data-[…]).
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#reply-")) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.setAttribute("data-highlight", "");
    const t = setTimeout(() => el.removeAttribute("data-highlight"), 2500);
    return () => {
      clearTimeout(t);
      el.removeAttribute("data-highlight");
    };
  }, []);

  const isLoggedIn = !!viewerId;
  const isBlocked = (authorId: string) => blockedIds.includes(authorId);

  // Lo que ofrece el «⋯» de un mensaje ajeno: denunciarlo y bloquear (o
  // desbloquear) a quien lo escribe.
  const moderationItems = (kind: "thread" | "reply", id: string, author: CommunityAuthor): MoreMenuItem[] => {
    if (!viewerId || author.id === viewerId) return [];
    return [
      { label: kind === "thread" ? "🚩 Denunciar hilo" : "🚩 Denunciar respuesta", onClick: () => setReporting({ type: kind, id }) },
      isBlocked(author.id)
        ? {
            label: `Desbloquear a ${author.name}`,
            onClick: async () => {
              if (!(await unblockUser(author.id))) return showToast("No se pudo desbloquear");
              setBlockedIds((prev) => prev.filter((b) => b !== author.id));
              showToast(`Has desbloqueado a ${author.name}`);
            },
          }
        : { label: `🚫 Bloquear a ${author.name}`, onClick: () => setBlocking(author), danger: true },
    ];
  };

  const isThreadAuthor = !!thread && thread.author.id === viewerId;
  const liveReplies = replies.filter((r) => !r.deleted).length;

  const startEditThread = () => {
    if (!thread) return;
    setDraftTitle(thread.title);
    setDraftBody(thread.body);
    setDraftTag(thread.tag as CommunityTag);
    setEditingThread(true);
  };

  const saveThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread) return;
    setSavingThread(true);
    try {
      const res = await fetch(`/api/community/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, body: draftBody, tag: draftTag || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setThread((prev) => (prev ? { ...prev, ...data.thread } : prev));
      setEditingThread(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSavingThread(false);
    }
  };

  const togglePinned = async () => {
    if (!thread) return;
    const pinned = !thread.pinned;
    setThread({ ...thread, pinned });
    const res = await fetch(`/api/community/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }).catch(() => null);
    if (!res?.ok) {
      setThread((prev) => (prev ? { ...prev, pinned: !pinned } : prev));
      showToast("No se pudo cambiar");
      return;
    }
    showToast(pinned ? "Hilo fijado arriba 📌" : "Hilo desfijado");
  };

  const sendReply = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!thread || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/community/${thread.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo publicar");
      setReplies((prev) => [...prev, data.reply]);
      setReplyText("");
      nudgePush("community-reply");
      // Deja la respuesta recién publicada a la vista.
      requestAnimationFrame(() =>
        document.getElementById(`reply-${data.reply.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "No se pudo publicar");
    } finally {
      setSendingReply(false);
    }
  };

  const saveReply = async (replyId: string) => {
    if (!thread) return;
    setSavingReply(true);
    try {
      const res = await fetch(`/api/community/${thread.id}/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draftReply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId && !r.deleted ? { ...r, body: data.reply.body, editedAt: data.reply.editedAt } : r
        )
      );
      setEditingReplyId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSavingReply(false);
    }
  };

  const confirmDelete = async () => {
    if (!thread || !pendingDelete) return;
    setDeleting(true);
    try {
      const url =
        pendingDelete.kind === "thread"
          ? `/api/community/${thread.id}`
          : `/api/community/${thread.id}/replies/${pendingDelete.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo borrar");

      if (pendingDelete.kind === "thread") {
        router.push("/community");
        return;
      }
      const replyId = pendingDelete.id;
      setReplies((prev) =>
        prev.map((r) => (r.id === replyId ? { id: r.id, deleted: true, createdAt: r.createdAt } : r))
      );
      setPendingDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <main className="max-w-3xl mx-auto py-6 sm:py-10 px-4">
        {banner}
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Comunidad
        </Link>

        {/* Mensaje que abre el hilo */}
        <article className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[var(--card-shadow)]">
          {editingThread ? (
            <form onSubmit={saveThread} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {COMMUNITY_TAGS.map((t) => {
                  const selected = draftTag === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDraftTag(t.id)}
                      aria-pressed={selected}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                        selected ? "" : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                      }`}
                      style={selected ? { color: t.accent, borderColor: t.accent, backgroundColor: `${t.accent}1a` } : undefined}
                    >
                      <span aria-hidden>{t.emoji}</span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                required
                minLength={3}
                maxLength={THREAD_TITLE_MAX}
                className={`${inputClass} font-semibold`}
                aria-label="Título"
              />
              <EmojiField
                value={draftBody}
                onChange={setDraftBody}
                required
                maxLength={THREAD_BODY_MAX}
                rows={8}
                className={`${inputClass} resize-y`}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingThread(false)} className={ghostBtn}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingThread} className={primaryBtn}>
                  {savingThread ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {thread.pinned && (
                  <span className="text-[11px] font-semibold text-[var(--primary)]">📌 Fijado</span>
                )}
                <TagChip tag={thread.tag} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-4">{thread.title}</h1>
              <div className="flex items-center gap-2 mb-5">
                <AuthorLink author={thread.author} size="sm" className="text-sm" />
                <span className="text-[var(--text-muted)] text-xs">·</span>
                <Timestamp createdAt={thread.createdAt} editedAt={thread.editedAt} />
                <MoreMenu
                  items={moderationItems("thread", thread.id, thread.author)}
                  className="ml-auto -my-1"
                />
              </div>
              {isBlocked(thread.author.id) && !revealed.has(thread.id) ? (
                <BlockedNotice
                  what="Este hilo es de un usuario que has bloqueado."
                  onShow={() => setRevealed((prev) => new Set(prev).add(thread.id))}
                />
              ) : (
                <PostText text={thread.body} className="text-[15px] text-[var(--text)]" />
              )}

              {(isThreadAuthor || isAdmin) && (
                <div className="flex flex-wrap justify-end gap-1 mt-5 pt-3 border-t border-[var(--border)]">
                  {isAdmin && (
                    <button type="button" onClick={togglePinned} className={ghostBtn}>
                      {thread.pinned ? "Desfijar" : "📌 Fijar arriba"}
                    </button>
                  )}
                  {isThreadAuthor && (
                    <button type="button" onClick={startEditThread} className={ghostBtn}>
                      Editar
                    </button>
                  )}
                  <button type="button" onClick={() => setPendingDelete({ kind: "thread" })} className={dangerBtn}>
                    Borrar hilo
                  </button>
                </div>
              )}
            </>
          )}
        </article>

        {/* Respuestas */}
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mt-10 mb-4">
          {liveReplies === 0 ? "Sin respuestas todavía" : `${liveReplies} respuesta${liveReplies === 1 ? "" : "s"}`}
        </h2>

        {replies.length > 0 && (
          <ol className="space-y-3">
            {replies.map((r, i) =>
              r.deleted ? (
                <li
                  key={r.id}
                  id={`reply-${r.id}`}
                  className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-3 text-sm italic text-[var(--text-muted)]"
                >
                  {r.hidden ? "Mensaje oculto mientras lo revisamos" : "Mensaje eliminado"}
                </li>
              ) : isBlocked(r.author.id) && !revealed.has(r.id) ? (
                <li
                  key={r.id}
                  id={`reply-${r.id}`}
                  className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-3"
                >
                  <BlockedNotice
                    what="Mensaje de un usuario bloqueado."
                    onShow={() => setRevealed((prev) => new Set(prev).add(r.id))}
                  />
                </li>
              ) : (
                <li
                  key={r.id}
                  id={`reply-${r.id}`}
                  className="flex gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--card-shadow)] scroll-mt-24 transition-colors duration-700 data-[highlight]:border-[var(--primary)] data-[highlight]:ring-2 data-[highlight]:ring-[var(--primary)]/30"
                >
                  <div className="shrink-0 hidden sm:block">
                    <Avatar name={r.author.name} avatarUrl={r.author.avatarUrl} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
                      <AuthorLink author={r.author} className="text-sm" avatarClassName="sm:hidden" />
                      {r.author.id === thread.author.id && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--primary)]">
                          Autor
                        </span>
                      )}
                      <Timestamp createdAt={r.createdAt} editedAt={r.editedAt} />
                      <a
                        href={`#reply-${r.id}`}
                        className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--primary)] tabular-nums"
                        title="Enlace a esta respuesta"
                      >
                        #{i + 1}
                      </a>
                      <MoreMenu items={moderationItems("reply", r.id, r.author)} className="-my-1.5 -mr-1.5" />
                    </div>

                    {editingReplyId === r.id ? (
                      <div className="space-y-2">
                        <EmojiField
                          value={draftReply}
                          onChange={setDraftReply}
                          maxLength={REPLY_BODY_MAX}
                          rows={4}
                          className={`${inputClass} resize-y text-sm`}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingReplyId(null)} className={ghostBtn}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveReply(r.id)}
                            disabled={savingReply || !draftReply.trim()}
                            className={primaryBtn}
                          >
                            {savingReply ? "Guardando…" : "Guardar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <PostText text={r.body} className="text-sm text-[var(--text)]" />
                    )}

                    {editingReplyId !== r.id && (r.author.id === viewerId || isAdmin) && (
                      <div className="flex justify-end gap-1 mt-2 -mb-1">
                        {r.author.id === viewerId && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftReply(r.body);
                              setEditingReplyId(r.id);
                            }}
                            className={ghostBtn}
                          >
                            Editar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ kind: "reply", id: r.id })}
                          className={dangerBtn}
                        >
                          Borrar
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            )}
          </ol>
        )}

        {/* Caja para responder */}
        <div className="mt-6">
          {isLoggedIn ? (
            <form
              onSubmit={sendReply}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--card-shadow)]"
            >
              <EmojiField
                value={replyText}
                onChange={setReplyText}
                maxLength={REPLY_BODY_MAX}
                rows={4}
                placeholder={liveReplies === 0 ? "Sé el primero en responder…" : "Escribe tu respuesta…"}
                className={`${inputClass} resize-y text-sm`}
                onKeyDown={(e) => {
                  // Cmd/Ctrl + Enter publica, como en casi todos los foros.
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              {replyError && <p className="text-red-400 text-sm mt-2">{replyError}</p>}
              <div className="flex items-center justify-between gap-3 mt-3">
                <span className="hidden sm:inline text-xs text-[var(--text-muted)]">⌘/Ctrl + Enter para publicar</span>
                <button type="submit" disabled={sendingReply || !replyText.trim()} className={`${primaryBtn} ml-auto`}>
                  {sendingReply ? "Publicando…" : "Responder"}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-[var(--text-secondary)] mb-3">¿Tienes algo que añadir?</p>
              <Link href={`/login?redirect=/community/${thread.id}`} className={primaryBtn}>
                Entra para responder
              </Link>
            </div>
          )}
        </div>

        <ModerationNote />
      </main>

      {reporting && (
        <ReportModal targetType={reporting.type} targetId={reporting.id} onClose={() => setReporting(null)} />
      )}

      {blocking && (
        <BlockModal
          user={blocking}
          onClose={() => setBlocking(null)}
          onBlocked={() => {
            const name = blocking.name;
            setBlockedIds((prev) => [...prev, blocking.id]);
            setBlocking(null);
            showToast(`Has bloqueado a ${name}. Ya no verás sus mensajes`);
          }}
        />
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">
              {pendingDelete.kind === "thread" ? "¿Borrar el hilo?" : "¿Borrar la respuesta?"}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {pendingDelete.kind === "thread"
                ? "Desaparecerá de la comunidad junto con todas sus respuestas."
                : "En su lugar quedará un aviso de «Mensaje eliminado»."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-50"
              >
                {deleting ? "Borrando…" : "Borrar"}
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
    </>
  );
}

/** Lo que queda en lugar de un mensaje de alguien bloqueado. */
function BlockedNotice({ what, onShow }: { what: string; onShow: () => void }) {
  return (
    <p className="text-sm italic text-[var(--text-muted)]">
      🚫 {what}{" "}
      <button
        type="button"
        onClick={onShow}
        className="not-italic font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] underline underline-offset-2"
      >
        Mostrar
      </button>
    </p>
  );
}
