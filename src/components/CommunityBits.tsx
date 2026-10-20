"use client";

import Link from "next/link";
import { Fragment } from "react";
import Avatar from "./Avatar";
import { getCommunityTag } from "@/lib/community";
import { profileHref } from "@/lib/users";
import { CONTACT_EMAIL } from "@/lib/contact";

// Piezas compartidas por el listado y la ficha de un hilo de /community.

export interface CommunityAuthor {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
}

/** Chapita de color con el emoji y el nombre de la etiqueta. */
export function TagChip({ tag, className = "" }: { tag: string; className?: string }) {
  const t = getCommunityTag(tag);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${className}`}
      style={{ color: t.accent, backgroundColor: `${t.accent}1f` }}
    >
      <span aria-hidden>{t.emoji}</span>
      {t.label}
    </span>
  );
}

/**
 * Avatar + nombre enlazando al perfil público. Con `nofollow`: la Comunidad
 * es indexable y no queremos que sea la puerta de los buscadores a los
 * perfiles (ver el punto 5 de BACKLOG.md).
 */
export function AuthorLink({
  author,
  size = "xs",
  className = "",
  avatarClassName = "",
}: {
  author: CommunityAuthor;
  size?: "xs" | "sm" | "md";
  className?: string;
  avatarClassName?: string;
}) {
  return (
    <Link
      href={profileHref(author)}
      rel="nofollow"
      className={`inline-flex items-center gap-2 min-w-0 font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors ${className}`}
    >
      <Avatar name={author.name} avatarUrl={author.avatarUrl} size={size} className={avatarClassName} />
      <span className="truncate">{author.name}</span>
    </Link>
  );
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
// Puntuación que suele ir pegada al final de un enlace pero no es parte de él.
const TRAILING = /[.,;:!?)\]»"']+$/;

/**
 * Texto plano de un mensaje, respetando saltos de línea y con los enlaces
 * clicables. React escapa todo lo demás, así que no hay HTML del usuario.
 */
export function PostText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <div className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const trail = part.match(TRAILING)?.[0] ?? "";
        const href = trail ? part.slice(0, -trail.length) : part;
        return (
          <Fragment key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="text-[var(--primary)] underline underline-offset-2 decoration-[var(--primary)]/40 hover:decoration-[var(--primary)] break-all"
            >
              {href}
            </a>
            {trail}
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * Pie de la Comunidad: cómo denunciar y a quién escribir. Lo piden App Store
 * y Google Play en cualquier sitio con contenido de los usuarios.
 */
export function ModerationNote({ className = "" }: { className?: string }) {
  return (
    <p className={`mt-10 text-center text-xs text-[var(--text-muted)] leading-relaxed ${className}`}>
      🛡️ ¿Algo fuera de lugar? Denúncialo desde el menú <span aria-label="tres puntos">⋯</span> del mensaje
      o escribe a moderación en{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-[var(--primary)]">
        {CONTACT_EMAIL}
      </a>
      . Lo revisamos en menos de 24 horas.{" "}
      <Link href="/terms#normas" className="underline underline-offset-2 hover:text-[var(--primary)]">
        Normas de la Comunidad
      </Link>
    </p>
  );
}
