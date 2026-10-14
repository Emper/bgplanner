"use client";

import Link from "next/link";
import { Fragment } from "react";
import Avatar from "./Avatar";
import { getCommunityTag } from "@/lib/community";
import { profileHref } from "@/lib/users";

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

/** Avatar + nombre enlazando al perfil público. */
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
