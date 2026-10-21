"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { loginHref } from "@/lib/site";
import { plural } from "@/lib/text";
import Button, { ButtonLink, CloseButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FieldError, Input, fieldClass } from "@/components/ui/Field";
import { BackLink } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

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

// El mensaje al que contesta una respuesta (ver toReplyQuote)
type Quote =
  | { replyId: string; deleted: true }
  | { replyId: string; deleted: false; author: CommunityAuthor; excerpt: string };

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
      likes: number;
      quote: Quote | null;
    };

type LiveReply = Extract<Reply, { deleted: false }>;

type PendingDelete = { kind: "thread" } | { kind: "reply"; id: string } | null;

// «Borrar» en las acciones pequeñas de cada mensaje: fantasma como el resto
// hasta que se pasa por encima, y entonces en rojo.
const smallDanger = "hover:text-[var(--danger)]! hover:bg-[var(--danger-soft)]!";

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
  initialLikedIds = [],
  banner,
}: {
  initial: ThreadInitial;
  viewerId: string | null;
  isAdmin: boolean;
  /** A quién ha bloqueado quien mira: sus mensajes salen plegados. */
  initialBlockedIds?: string[];
  /** Respuestas a las que quien mira ya ha dado «me gusta». */
  initialLikedIds?: string[];
  /** Lo que va arriba del todo (la invitación a registrarse, sin sesión). */
  banner?: React.ReactNode;
}) {
  const router = useRouter();

  const [thread, setThread] = useState<Thread>(initial.thread);
  const [replies, setReplies] = useState<Reply[]>(initial.replies);
  const toast = useToast();

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

  // Respuesta nueva (y el mensaje que cita, si contesta a uno concreto)
  const [replyText, setReplyText] = useState("");
  const [quoting, setQuoting] = useState<LiveReply | null>(null);

  // «Me gusta»: los míos y los que están en vuelo
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set(initialLikedIds));
  const [likeBusy, setLikeBusy] = useState<Set<string>>(new Set());
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
    return highlightReply(hash.slice("#reply-".length));
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
              if (!(await unblockUser(author.id))) return toast.error("No se pudo desbloquear");
              setBlockedIds((prev) => prev.filter((b) => b !== author.id));
              toast(`Has desbloqueado a ${author.name}`);
            },
          }
        : { label: `🚫 Bloquear a ${author.name}`, onClick: () => setBlocking(author), danger: true },
    ];
  };

  const toggleLike = async (r: LiveReply) => {
    if (!viewerId || r.author.id === viewerId || likeBusy.has(r.id)) return;
    const wasLiked = likedIds.has(r.id);
    const setLike = (liked: boolean, likes: number) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(r.id);
        else next.delete(r.id);
        return next;
      });
      setReplies((prev) => prev.map((x) => (x.id === r.id && !x.deleted ? { ...x, likes } : x)));
    };
    // Optimista: el corazón cambia al momento y se corrige con la respuesta.
    setLike(!wasLiked, r.likes + (wasLiked ? -1 : 1));
    setLikeBusy((prev) => new Set(prev).add(r.id));
    try {
      const res = await fetch(`/api/community/${threadId}/replies/${r.id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar tu «me gusta»");
      setLike(data.liked, data.likes);
    } catch (err) {
      setLike(wasLiked, r.likes);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar tu «me gusta»");
    } finally {
      setLikeBusy((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  };

  // «Citar»: la respuesta se prepara contestando a ese mensaje y la caja de
  // abajo se pone a tiro.
  const startQuote = (r: LiveReply) => {
    setQuoting(r);
    requestAnimationFrame(() => {
      const box = document.getElementById("reply-composer");
      box?.scrollIntoView({ behavior: "smooth", block: "center" });
      box?.querySelector("textarea")?.focus({ preventScroll: true });
    });
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
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
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
      toast.error("No se pudo cambiar");
      return;
    }
    toast(pinned ? "Hilo fijado arriba 📌" : "Hilo desfijado");
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
        body: JSON.stringify({ body: replyText, quotedReplyId: quoting?.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo publicar");
      setReplies((prev) => [...prev, data.reply]);
      setReplyText("");
      setQuoting(null);
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
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
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
      // Las citas a ese mensaje se quedan en su hueco, como al recargar.
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? { id: r.id, deleted: true, createdAt: r.createdAt }
            : !r.deleted && r.quote?.replyId === replyId
              ? { ...r, quote: { replyId, deleted: true } }
              : r
        )
      );
      if (quoting?.id === replyId) setQuoting(null);
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {banner}
      <BackLink href="/community" className="mb-5">
        Comunidad
      </BackLink>

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
            <Input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              required
              minLength={3}
              maxLength={THREAD_TITLE_MAX}
              className="font-semibold"
              aria-label="Título"
            />
            <EmojiField
              value={draftBody}
              onChange={setDraftBody}
              required
              maxLength={THREAD_BODY_MAX}
              rows={8}
              className={fieldClass({ className: "resize-y" })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingThread(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={savingThread}>
                {savingThread ? "Guardando…" : "Guardar cambios"}
              </Button>
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
            <h1 className="page-title leading-tight mb-4">{thread.title}</h1>
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
                  <Button variant="ghost" size="xs" onClick={togglePinned}>
                    {thread.pinned ? "Desfijar" : "📌 Fijar arriba"}
                  </Button>
                )}
                {isThreadAuthor && (
                  <Button variant="ghost" size="xs" onClick={startEditThread}>
                    Editar
                  </Button>
                )}
                <Button variant="ghost" size="xs" onClick={() => setPendingDelete({ kind: "thread" })} className={smallDanger}>
                  Borrar hilo
                </Button>
              </div>
            )}
          </>
        )}
      </article>

      {/* Respuestas */}
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mt-10 mb-4">
        {liveReplies === 0 ? "Sin respuestas todavía" : plural(liveReplies, "respuesta", "respuestas")}
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
                        className={fieldClass({ className: "resize-y" })}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingReplyId(null)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveReply(r.id)}
                          disabled={!draftReply.trim()}
                          loading={savingReply}
                        >
                          {savingReply ? "Guardando…" : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {r.quote && (
                        <QuoteBlock
                          quote={r.quote}
                          blocked={!r.quote.deleted && isBlocked(r.quote.author.id)}
                          onJump={() => highlightReply(r.quote!.replyId)}
                        />
                      )}
                      <PostText text={r.body} className="text-sm text-[var(--text)]" />
                    </>
                  )}

                  {editingReplyId !== r.id && (
                    <div className="flex items-center gap-1 mt-2 -mb-1 -ml-2">
                      <LikeButton
                        count={r.likes}
                        liked={likedIds.has(r.id)}
                        own={r.author.id === viewerId}
                        loginHref={isLoggedIn ? null : loginHref(`/community/${thread.id}#reply-${r.id}`)}
                        busy={likeBusy.has(r.id)}
                        onToggle={() => toggleLike(r)}
                      />
                      {isLoggedIn && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => startQuote(r)}
                         
                          title="Responder a este mensaje citándolo"
                        >
                          ↩︎ Citar
                        </Button>
                      )}
                      <span className="flex-1" />
                      {r.author.id === viewerId && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setDraftReply(r.body);
                            setEditingReplyId(r.id);
                          }}
                         
                        >
                          Editar
                        </Button>
                      )}
                      {(r.author.id === viewerId || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setPendingDelete({ kind: "reply", id: r.id })}
                          className={smallDanger}
                        >
                          Borrar
                        </Button>
                      )}
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
            id="reply-composer"
            onSubmit={sendReply}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--card-shadow)] scroll-mt-24"
          >
            {quoting && (
              <div className="flex items-start gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1">
                    ↩︎ Respondiendo a <span className="text-[var(--text-secondary)]">{quoting.author.name}</span>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] border-l-2 border-[var(--primary)]/50 pl-2.5 line-clamp-2 whitespace-pre-wrap break-words">
                    {quoting.body}
                  </p>
                </div>
                <CloseButton size="sm" label="Quitar la cita" onClick={() => setQuoting(null)} />
              </div>
            )}
            <EmojiField
              value={replyText}
              onChange={setReplyText}
              maxLength={REPLY_BODY_MAX}
              rows={4}
              placeholder={
                quoting
                  ? `Contesta a ${quoting.author.name}…`
                  : liveReplies === 0
                    ? "Sé el primero en responder…"
                    : "Escribe tu respuesta…"
              }
              className={fieldClass({ className: "resize-y" })}
              onKeyDown={(e) => {
                // Cmd/Ctrl + Enter publica, como en casi todos los foros.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendReply();
                }
              }}
            />
            <FieldError className="mt-2">{replyError}</FieldError>
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="hidden sm:inline text-xs text-[var(--text-muted)]">⌘/Ctrl + Enter para publicar</span>
              <Button type="submit" disabled={!replyText.trim()} loading={sendingReply} className="ml-auto">
                {sendingReply ? "Publicando…" : "Responder"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-[var(--text-secondary)] mb-3">¿Tienes algo que añadir?</p>
            <ButtonLink href={loginHref(`/community/${thread.id}`)}>Entra para responder</ButtonLink>
          </div>
        )}
      </div>

      <ModerationNote />

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
            toast(`Has bloqueado a ${name}. Ya no verás sus mensajes`);
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title={pendingDelete?.kind === "thread" ? "¿Borrar el hilo?" : "¿Borrar la respuesta?"}
        body={
          pendingDelete?.kind === "thread"
            ? "Desaparecerá de la comunidad junto con todas sus respuestas."
            : "En su lugar quedará un aviso de «Mensaje eliminado»."
        }
        confirmLabel={deleting ? "Borrando…" : "Borrar"}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
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

/** Lleva una respuesta a la vista y la resalta un momento. Devuelve cómo deshacerlo. */
function highlightReply(replyId: string) {
  const el = document.getElementById(`reply-${replyId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.setAttribute("data-highlight", "");
  const t = setTimeout(() => el.removeAttribute("data-highlight"), 2500);
  return () => {
    clearTimeout(t);
    el.removeAttribute("data-highlight");
  };
}

/** El mensaje al que contesta una respuesta, encima de su texto. */
function QuoteBlock({ quote, blocked, onJump }: { quote: Quote; blocked: boolean; onJump: () => void }) {
  return (
    <a
      href={`#reply-${quote.replyId}`}
      onClick={(e) => {
        e.preventDefault();
        onJump();
      }}
      className="block mb-2 rounded-xl border-l-2 border-[var(--primary)]/50 bg-[var(--surface-hover)]/60 hover:bg-[var(--surface-hover)] px-3 py-2 transition-colors"
      title="Ir al mensaje citado"
    >
      {quote.deleted ? (
        <span className="text-xs italic text-[var(--text-muted)]">↩︎ Contesta a un mensaje que ya no está</span>
      ) : blocked ? (
        <span className="text-xs italic text-[var(--text-muted)]">↩︎ Contesta a un usuario que has bloqueado</span>
      ) : (
        <>
          <span className="block text-xs font-medium text-[var(--text-muted)] mb-0.5">
            ↩︎ {quote.author.name} escribió:
          </span>
          <span className="block text-xs text-[var(--text-secondary)] line-clamp-3 whitespace-pre-wrap break-words">
            {quote.excerpt}
          </span>
        </>
      )}
    </a>
  );
}

/**
 * Corazón con su contador. Sin sesión lleva al login; en una respuesta propia
 * solo enseña cuántos tiene.
 */
function LikeButton({
  count,
  liked,
  own,
  loginHref,
  busy,
  onToggle,
}: {
  count: number;
  liked: boolean;
  own: boolean;
  loginHref: string | null;
  busy: boolean;
  onToggle: () => void;
}) {
  const label = count > 0 ? <span className="tabular-nums">{count}</span> : null;
  const cls = `inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
    liked ? "text-rose-500" : "text-[var(--text-muted)]"
  }`;
  const heart = (
    <svg
      className={`w-4 h-4 transition-transform ${liked ? "scale-110" : ""}`}
      viewBox="0 0 24 24"
      fill={liked ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );

  if (loginHref) {
    return (
      <Link href={loginHref} className={`${cls} hover:text-rose-500`} title="Entra para dar «me gusta»">
        {heart}
        {label}
      </Link>
    );
  }
  if (own) {
    if (count === 0) return null;
    return (
      <span className={cls} title={`${count} ${count === 1 ? "persona" : "personas"} le dan «me gusta»`}>
        {heart}
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={liked}
      title={liked ? "Quitar «me gusta»" : "Me gusta"}
      className={`${cls} hover:text-rose-500 hover:bg-rose-500/10`}
    >
      {heart}
      {label}
    </button>
  );
}
