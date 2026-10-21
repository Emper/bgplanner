"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import EmojiField from "@/components/EmojiField";
import PageLoader from "@/components/PageLoader";
import Avatar from "@/components/Avatar";
import { AuthorLink, ModerationNote, TagChip, type CommunityAuthor } from "@/components/CommunityBits";
import { spotlightMove } from "@/components/motion";
import {
  COMMUNITY_TAGS,
  THREAD_BODY_MAX,
  THREAD_TITLE_MAX,
  isCommunityTag,
  type CommunityTag,
} from "@/lib/community";
import { formatRelativeTime } from "@/lib/format";
import { nudgePush } from "@/lib/pushNudge";
import { loginHref } from "@/lib/site";
import { plural } from "@/lib/text";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import Alert from "@/components/ui/Alert";
import Button, { ButtonLink, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldError, Input, LABEL_CLASS, fieldClass } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";

interface ThreadItem {
  id: string;
  title: string;
  excerpt: string;
  tag: string;
  pinned: boolean;
  createdAt: string;
  lastActivityAt: string;
  author: CommunityAuthor;
  replyCount: number;
  lastReply: { createdAt: string; author: CommunityAuthor } | null;
}

export interface ThreadPage {
  threads: ThreadItem[];
  nextCursor: string | null;
  tagCounts?: Record<string, number>;
}

interface ListResponse extends ThreadPage {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

// El listado llega ya pintado del servidor (para buscadores y para quien no
// tiene cuenta); a partir de ahí, filtros, búsqueda y «ver más» van por la API.
export default function CommunityClient({
  initial,
  initialLoggedIn,
  initialKey,
  banner,
}: {
  /** Lo que va arriba del todo (la invitación a registrarse, sin sesión). */
  banner?: React.ReactNode;
  initial: ThreadPage;
  initialLoggedIn: boolean;
  /** Etiqueta con la que se pidió `initial` ("" = todas). */
  initialKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag");
  const activeTag: CommunityTag | null = isCommunityTag(tagParam) ? tagParam : null;

  const [threads, setThreads] = useState<ThreadItem[]>(initial.threads);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>(initial.tagCounts ?? {});
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Búsqueda: lo que se escribe y lo que de verdad se consulta (con pausa).
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), 300);

  // Formulario de hilo nuevo: cerrado hasta que se pulsa el botón.
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newTag, setNewTag] = useState<CommunityTag | "">("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (activeTag) params.set("tag", activeTag);
      if (query) params.set("q", query);
      if (cursor) params.set("cursor", cursor);
      const qs = params.toString();
      return `/api/community${qs ? `?${qs}` : ""}`;
    },
    [activeTag, query]
  );

  // Cada cambio de filtro o búsqueda descarta la respuesta anterior si llega
  // tarde, para no pintar resultados de otro filtro.
  const requestId = useRef(0);
  // Lo que ya trae el servidor no se vuelve a pedir: ni al montar ni al
  // cambiar de etiqueta (los filtros son enlaces y la navegación ya trae la
  // página nueva pintada). Solo la búsqueda va por la API.
  const loadedKey = useRef(`${initialKey}|`);
  // Cuando la navegación trae otra página pintada, se adopta en el mismo render.
  const [shownInitial, setShownInitial] = useState(initial);
  if (shownInitial !== initial) {
    setShownInitial(initial);
    setThreads(initial.threads);
    setNextCursor(initial.nextCursor);
    if (initial.tagCounts) setTagCounts(initial.tagCounts);
  }
  useEffect(() => {
    loadedKey.current = `${initialKey}|`;
  }, [initial, initialKey]);
  useEffect(() => {
    const key = `${activeTag ?? ""}|${query}`;
    if (key === loadedKey.current) return;
    loadedKey.current = key;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    fetch(buildUrl())
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: ListResponse) => {
        if (id !== requestId.current) return;
        setThreads(data.threads);
        setNextCursor(data.nextCursor);
        setIsLoggedIn(data.isLoggedIn);
        if (data.tagCounts) setTagCounts(data.tagCounts);
      })
      .catch(() => id === requestId.current && setError("No se pudieron cargar las conversaciones"))
      .finally(() => id === requestId.current && setLoading(false));
  }, [buildUrl, activeTag, query]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextCursor));
      if (!res.ok) throw new Error();
      const data: ListResponse = await res.json();
      setThreads((prev) => [...prev, ...data.threads.filter((t) => !prev.some((p) => p.id === t.id))]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("No se pudieron cargar más conversaciones");
    } finally {
      setLoadingMore(false);
    }
  };

  const tagHref = (tag: CommunityTag | null) => (tag ? `${pathname}?tag=${tag}` : pathname);

  const openForm = () => {
    setFormOpen((v) => !v);
    // Si estás mirando una etiqueta, lo normal es querer escribir en ella.
    if (!newTag && activeTag) setNewTag(activeTag);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag) {
      setFormError("Elige una etiqueta para tu hilo");
      return;
    }
    setSending(true);
    setFormError("");
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, tag: newTag }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo publicar");
      router.push(`/community/${data.id}`);
      nudgePush("community-thread");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo publicar");
      setSending(false);
    }
  };

  // Enlace para abrir un hilo ya rellenado (?nuevo=1&tag=…&titulo=…&texto=…),
  // p. ej. «Anúncialo en la Comunidad» desde un evento. Se aplica una vez, en
  // cuanto sabemos que hay sesión, y se limpia la URL para no repetirlo.
  const [prefillApplied, setPrefillApplied] = useState(false);
  const wantsPrefill = searchParams.get("nuevo") === "1";
  if (wantsPrefill && isLoggedIn && !prefillApplied) {
    setPrefillApplied(true);
    const t = searchParams.get("titulo");
    const b = searchParams.get("texto");
    if (t) setTitle(t.slice(0, THREAD_TITLE_MAX));
    if (b) setBody(b.slice(0, THREAD_BODY_MAX));
    if (activeTag) setNewTag(activeTag);
    setFormOpen(true);
  }
  useEffect(() => {
    if (!prefillApplied || !wantsPrefill) return;
    router.replace(activeTag ? `${pathname}?tag=${activeTag}` : pathname, { scroll: false });
  }, [prefillApplied, wantsPrefill, activeTag, pathname, router]);

  // Sin sesión, el login vuelve aquí con lo que traía la URL (filtro o
  // borrador de hilo incluidos).
  const query_ = searchParams.toString();
  const loginUrl = loginHref(`${pathname}${query_ ? `?${query_}` : ""}`);

  const totalThreads = Object.values(tagCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      {banner}
      <PageHeader
        title="Comunidad"
        lead="La mesa grande de BG Planner: busca gente para jugar, cuenta qué tal fue esa partida épica o pregunta la regla que nadie en tu grupo recuerda."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {isLoggedIn ? (
          <Button size="lg" onClick={openForm}>
            {formOpen ? "Cerrar" : "Abrir un hilo"}
          </Button>
        ) : (
          !loading && (
            <ButtonLink href={loginUrl} size="lg">
              Entra para participar
            </ButtonLink>
          )
        )}
      </div>

      {formOpen && isLoggedIn && (
        <form
          onSubmit={submit}
          className="space-y-5 mb-10 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--card-shadow)]"
        >
          <div>
            <span className={LABEL_CLASS}>¿De qué va?</span>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_TAGS.map((t) => {
                const selected = newTag === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewTag(t.id)}
                    title={t.hint}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      selected
                        ? "shadow-sm"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                    }`}
                    style={
                      selected
                        ? { color: t.accent, borderColor: t.accent, backgroundColor: `${t.accent}1a` }
                        : undefined
                    }
                  >
                    <span aria-hidden>{t.emoji}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {newTag && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {COMMUNITY_TAGS.find((t) => t.id === newTag)?.hint}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="thread-title" className={LABEL_CLASS}>
              Título
            </label>
            <Input
              id="thread-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={THREAD_TITLE_MAX}
              placeholder="Buscamos cuarto jugador para Brass en Madrid"
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Mensaje</label>
            <EmojiField
              value={body}
              onChange={setBody}
              required
              maxLength={THREAD_BODY_MAX}
              rows={6}
              className={fieldClass({ className: "resize-y" })}
              placeholder="Cuéntalo con todo el detalle que quieras"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              La comunidad es pública: cualquiera puede leer lo que publiques aquí, con tu nombre.
            </p>
          </div>

          <FieldError>{formError}</FieldError>

          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={sending}>
              {sending ? "Publicando…" : "Publicar hilo"}
            </Button>
          </div>
        </form>
      )}

      {/* Filtros por etiqueta: en móvil se deslizan en una fila. */}
      <div className="-mx-4 px-4 overflow-x-auto mb-4 [scrollbar-width:none]">
        <div className="flex gap-2 w-max">
          <FilterChip active={!activeTag} href={tagHref(null)} count={totalThreads || undefined}>
            Todo
          </FilterChip>
          {COMMUNITY_TAGS.map((t) => (
            <FilterChip
              key={t.id}
              active={activeTag === t.id}
              accent={t.accent}
              href={tagHref(activeTag === t.id ? null : t.id)}
              count={tagCounts[t.id]}
              title={t.hint}
            >
              <span aria-hidden>{t.emoji}</span> {t.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en las conversaciones"
          aria-label="Buscar en las conversaciones"
          className="pl-9"
        />
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading ? (
        <PageLoader withNavbar />
      ) : error && threads.length === 0 ? null : threads.length === 0 ? (
        <EmptyState
          variant="dashed"
          title={query ? "No hay conversaciones que encajen con esa búsqueda." : "Por aquí todavía no ha hablado nadie."}
          description={
            query ? "Prueba con otras palabras." : isLoggedIn ? "Rompe el hielo y abre el primer hilo." : "Entra y rompe el hielo."
          }
        />
      ) : (
        <ul className="space-y-3 fx-stagger">
          {threads.map((t) => (
            <ThreadCard key={t.id} thread={t} />
          ))}
        </ul>
      )}

      {!loading && nextCursor && (
        <div className="flex justify-center mt-6">
          {/* Enlace a la página siguiente (lo siguen los buscadores); con
              JavaScript, se añaden debajo sin cambiar de página. */}
          <a
            href={`${pathname}?${new URLSearchParams({ ...(activeTag ? { tag: activeTag } : {}), cursor: nextCursor })}`}
            onClick={(e) => {
              e.preventDefault();
              if (!loadingMore) loadMore();
            }}
            aria-disabled={loadingMore}
            className={buttonClass({ variant: "secondary", size: "lg", className: loadingMore ? "opacity-50" : "" })}
          >
            {loadingMore ? "Cargando…" : "Ver más conversaciones"}
          </a>
        </div>
      )}

      <ModerationNote />
    </>
  );
}

// Enlaces de verdad (no botones): así un buscador puede seguir cada etiqueta.
function FilterChip({
  active,
  accent,
  count,
  title,
  href,
  children,
}: {
  active: boolean;
  accent?: string;
  count?: number;
  title?: string;
  href: string;
  children: React.ReactNode;
}) {
  const color = accent || "var(--primary)";
  return (
    <Link
      href={href}
      replace
      scroll={false}
      title={title}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all duration-200 ${
        active
          ? ""
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-muted)]"
      }`}
      style={active ? { color, borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
    >
      {children}
      {count !== undefined && <span className="text-xs opacity-70 tabular-nums">{count}</span>}
    </Link>
  );
}

function ThreadCard({ thread: t }: { thread: ThreadItem }) {
  return (
    <li className="relative">
      <div
        onPointerMove={spotlightMove}
        className={`fx-spotlight relative flex gap-3 sm:gap-4 bg-[var(--surface)] border rounded-2xl p-4 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:border-[var(--primary)]/30 transition-all duration-200 ${
          t.pinned ? "border-[var(--primary)]/40" : "border-[var(--border)]"
        }`}
      >
        <div className="hidden sm:block shrink-0 pt-0.5">
          <Avatar name={t.author.name} avatarUrl={t.author.avatarUrl} size="md" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {t.pinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">
                📌 Fijado
              </span>
            )}
            <TagChip tag={t.tag} />
          </div>

          {/* El enlace cubre toda la tarjeta; el del autor queda por encima. */}
          <h2 className="font-semibold text-base sm:text-lg leading-snug">
            <Link href={`/community/${t.id}`} className="after:absolute after:inset-0 after:rounded-2xl hover:text-[var(--primary)] transition-colors">
              {t.title}
            </Link>
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{t.excerpt}</p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-[var(--text-muted)]">
            <AuthorLink author={t.author} className="relative z-10 text-xs" avatarClassName="sm:hidden" />
            <span>· {formatRelativeTime(t.createdAt)}</span>
            {t.lastReply && (
              <span className="w-full sm:w-auto">
                <span className="hidden sm:inline">· </span>
                última respuesta de{" "}
                <span className="text-[var(--text-secondary)]">{t.lastReply.author.name}</span>{" "}
                {formatRelativeTime(t.lastReply.createdAt)}
              </span>
            )}
          </div>
        </div>

        <div
          className={`shrink-0 self-start flex flex-col items-center justify-center w-12 rounded-xl py-1.5 border ${
            t.replyCount > 0
              ? "border-[var(--primary)]/30 bg-[var(--accent-soft)] text-[var(--primary)]"
              : "border-[var(--border)] text-[var(--text-muted)]"
          }`}
          title={plural(t.replyCount, "respuesta", "respuestas")}
        >
          <svg className="w-4 h-4" aria-hidden fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75m-6.75 3h4.5M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          <span className="text-sm font-semibold tabular-nums">{t.replyCount}</span>
        </div>
      </div>
    </li>
  );
}
