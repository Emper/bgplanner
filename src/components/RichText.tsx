import { Fragment, type ReactNode } from "react";

// Formato mínimo para textos largos que escriben los usuarios (la info general
// de un evento): párrafos separados por una línea en blanco, saltos de línea,
// listas con "- ", títulos con "## ", **negrita** y enlaces que se detectan
// solos. Todo se pinta como nodos de React, sin HTML del usuario por medio.

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "h"; text: string };

const BULLET = /^\s*[-•*]\s+/;
const HEADING = /^\s*#{1,3}\s+/;
const INLINE = /\*\*([^*\n]+?)\*\*|(https?:\/\/[^\s<>"]+)/g;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
    } else if (HEADING.test(line)) {
      flush();
      blocks.push({ kind: "h", text: line.replace(HEADING, "") });
    } else if (BULLET.test(line)) {
      if (current?.kind !== "ul") {
        flush();
        current = { kind: "ul", items: [] };
      }
      current.items.push(line.replace(BULLET, ""));
    } else {
      if (current?.kind !== "p") {
        flush();
        current = { kind: "p", lines: [] };
      }
      current.lines.push(line);
    }
  }
  flush();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (m[1]) {
      out.push(
        <strong key={start} className="font-semibold text-[var(--text)]">
          {m[1]}
        </strong>
      );
      last = start + m[0].length;
    } else {
      // La puntuación del final suele ser de la frase, no del enlace
      const url = m[2].replace(/[.,;:!?)\]]+$/, "");
      out.push(
        <a
          key={start}
          href={url}
          target="_blank"
          rel="nofollow ugc noopener noreferrer"
          className="text-[var(--primary)] underline underline-offset-2 break-all hover:text-[var(--primary-hover)]"
        >
          {url.replace(/^https?:\/\//, "")}
        </a>
      );
      last = start + url.length;
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-[var(--text-secondary)] break-words ${className}`}>
      {blocks.map((block, i) =>
        block.kind === "h" ? (
          <h3 key={i} className="pt-1 text-base font-bold text-[var(--text)]">
            {renderInline(block.text)}
          </h3>
        ) : block.kind === "ul" ? (
          <ul key={i} className="list-disc pl-5 space-y-1 marker:text-[var(--primary)]">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        )
      )}
    </div>
  );
}
