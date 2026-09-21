"use client";

import Image from "next/image";
import { useEffect } from "react";
import BggRating from "@/components/BggRating";
import KeepScoreSlider from "@/components/KeepScoreSlider";
import {
  KEEP_CLASSES,
  KEEP_EMOJI,
  KEEP_HEX,
  KEEP_LABELS,
  type CollectionItemView,
} from "@/lib/collection";
import { formatDateShort, formatDuration } from "@/lib/format";

// Las tarjetas de la colección (lista y cuadrícula) y la ficha de un juego.
// La tercera vista, la estantería, es GameShelf, que se comparte con las
// vitrinas de los perfiles. Se usan en "Mi colección" y en la colección que
// alguien comparte contigo; ahí van en modo lectura (`readOnly`), donde el
// slider se sustituye por la puntuación escrita.

export type CollectionView = "list" | "grid" | "shelf";

function playersLabel(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}-${max} jugadores`;
  const n = min || max;
  return `${n} jugador${n === 1 ? "" : "es"}`;
}

function weightLabel(w: number): string {
  if (w < 1.5) return "Ligero";
  if (w < 2.5) return "Medio-ligero";
  if (w < 3.5) return "Medio";
  if (w < 4.5) return "Pesado";
  return "Muy pesado";
}

// La portada grande solo llega tras resincronizar con BGG; hasta entonces
// tiramos del thumbnail de siempre.
function cover(item: { image: string | null; thumbnail: string | null }) {
  return item.image || item.thumbnail;
}

function Meta({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] whitespace-nowrap"
    >
      {children}
    </span>
  );
}

// Mi nota personal de BGG, marcada como propia para no confundirla con la
// media de la comunidad.
function MyRatingBadge({ rating, owner }: { rating: number; owner?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/30"
      title={owner ? `Nota de ${owner} en BGG: ${rating}` : `Tu nota en BGG: ${rating}`}
    >
      ★ {rating % 1 === 0 ? rating : rating.toFixed(1)}
    </span>
  );
}

// La puntuación de permanencia escrita, para cuando no se puede tocar.
function KeepBadge({
  score,
  inherited = false,
  compact = false,
}: {
  score: number | null;
  inherited?: boolean;
  compact?: boolean;
}) {
  if (!score) {
    return (
      <span className="text-[11px] text-[var(--text-muted)] italic">Sin valorar</span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${KEEP_CLASSES[score]}`}
      title={inherited ? "Hereda la puntuación del juego base" : undefined}
    >
      {KEEP_EMOJI[score]}
      {!compact && <span>{KEEP_LABELS[score]}</span>}
      {inherited && <span className="opacity-60 font-normal">heredada</span>}
    </span>
  );
}

// La estrella de la vitrina del perfil. En la colección de otro no se toca:
// ahí solo se ve si el dueño lo tiene destacado.
function ShowcaseStar({
  showcased,
  readOnly,
  onToggle,
  floating = false,
}: {
  showcased: boolean;
  readOnly: boolean;
  onToggle?: () => void;
  floating?: boolean;
}) {
  if (readOnly || !onToggle) {
    if (!showcased) return null;
    return (
      <span
        title="En la vitrina de su perfil"
        className={
          floating
            ? "absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-sm text-amber-300"
            : "text-[var(--primary)]"
        }
      >
        ★
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={showcased}
      title={
        showcased
          ? "Quitar de la vitrina de tu perfil"
          : "Añadir a la vitrina de tu perfil"
      }
      className={
        floating
          ? `absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-sm transition-colors ${
              showcased ? "text-amber-300" : "text-white/70 hover:text-amber-300"
            }`
          : `w-7 h-7 flex items-center justify-center rounded-lg text-base leading-none transition-colors ${
              showcased
                ? "text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)]"
            }`
      }
    >
      {showcased ? "★" : "☆"}
    </button>
  );
}

function GameMeta({ item }: { item: CollectionItemView }) {
  const players = playersLabel(item.minPlayers, item.maxPlayers);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.yearPublished && <Meta>{item.yearPublished}</Meta>}
      {players && (
        <Meta title={item.bestWith ? `Mejor con ${item.bestWith}` : undefined}>
          {players}
        </Meta>
      )}
      {item.playingTime ? <Meta>{formatDuration(item.playingTime)}</Meta> : null}
      {item.weight ? (
        <Meta title={`Peso ${item.weight.toFixed(1)}/5`}>{weightLabel(item.weight)}</Meta>
      ) : null}
      {item.bggRank && <Meta title="Puesto en el ranking de BGG">#{item.bggRank}</Meta>}
      <Meta title="Partidas registradas en BGG">
        🎲 {item.numPlays}
        {item.expansionPlays > 0 && ` (+${item.expansionPlays})`}
      </Meta>
      {item.dateAdded && (
        <Meta title="Fecha de alta en la colección de BGG">
          {formatDateShort(item.dateAdded)}
        </Meta>
      )}
    </div>
  );
}

export function ListRow({
  item,
  expanded,
  onToggleExpanded,
  onOpen,
  onScore,
  onToggleShowcase,
  readOnly = false,
  owner,
}: {
  item: CollectionItemView;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpen: () => void;
  onScore: (score: number | null) => void;
  onToggleShowcase?: () => void;
  readOnly?: boolean;
  owner?: string;
}) {
  const thumb = item.thumbnail;
  return (
    <div
      className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3"
      style={
        item.keepScore
          ? { borderLeft: `3px solid ${KEEP_HEX[item.keepScore]}` }
          : undefined
      }
    >
      <div className="flex gap-3">
        <button
          onClick={onOpen}
          className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-[var(--surface-hover)] flex items-center justify-center"
          title="Ver la ficha"
        >
          {thumb ? (
            <Image
              src={thumb}
              alt={item.name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl">🎲</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button onClick={onOpen} className="text-left min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-[var(--text)] truncate hover:text-[var(--primary)] transition-colors">
                {item.name}
              </h3>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <ShowcaseStar
                showcased={item.showcased}
                readOnly={readOnly}
                onToggle={onToggleShowcase}
              />
              {item.status === "wishlist" && <Meta title="Está en su wishlist de BGG">Lo quiere</Meta>}
              {item.userRating !== null && (
                <MyRatingBadge rating={item.userRating} owner={owner} />
              )}
              {item.bggRating !== null && <BggRating rating={item.bggRating} size={28} />}
            </div>
          </div>

          <div className="mt-1.5">
            <GameMeta item={item} />
          </div>

          {item.expansions.length > 0 && (
            <button
              onClick={onToggleExpanded}
              className="mt-1.5 text-[11px] text-[var(--primary)] hover:underline"
            >
              {expanded ? "▾" : "▸"} {item.expansions.length} expansi
              {item.expansions.length === 1 ? "ón" : "ones"}
            </button>
          )}

          {expanded && item.expansions.length > 0 && (
            <ul className="mt-1.5 space-y-1 border-l border-[var(--border)] pl-3">
              {item.expansions.map((exp) => (
                <li
                  key={exp.bggId}
                  className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]"
                >
                  <span className="truncate">{exp.name}</span>
                  <span className="shrink-0 flex items-center gap-1.5 text-[var(--text-muted)]">
                    {exp.numPlays > 0 && <span>🎲 {exp.numPlays}</span>}
                    {exp.ownKeepScore ? (
                      <span
                        title={`Puntuación propia: ${KEEP_LABELS[exp.ownKeepScore]}`}
                        style={{ color: KEEP_HEX[exp.ownKeepScore] }}
                      >
                        {KEEP_EMOJI[exp.ownKeepScore]}
                      </span>
                    ) : item.keepScore ? (
                      <span
                        title={`Hereda: ${KEEP_LABELS[item.keepScore]}`}
                        className="opacity-60"
                      >
                        {KEEP_EMOJI[item.keepScore]}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden sm:flex w-44 shrink-0 self-center justify-end">
          {readOnly ? (
            <KeepBadge score={item.keepScore} />
          ) : (
            <KeepScoreSlider value={item.keepScore} onChange={onScore} />
          )}
        </div>
      </div>

      <div className="sm:hidden mt-2">
        {readOnly ? (
          <KeepBadge score={item.keepScore} />
        ) : (
          <KeepScoreSlider value={item.keepScore} onChange={onScore} />
        )}
      </div>
    </div>
  );
}

export function GridCard({
  item,
  onOpen,
  onScore,
  onToggleShowcase,
  readOnly = false,
}: {
  item: CollectionItemView;
  onOpen: () => void;
  onScore: (score: number | null) => void;
  onToggleShowcase?: () => void;
  readOnly?: boolean;
}) {
  const img = cover(item);
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] overflow-hidden flex flex-col">
      {/* La portada es un div y no un botón: dentro va la estrella, y un
          botón dentro de otro botón no es HTML válido. */}
      <div className="relative aspect-square bg-[var(--surface-hover)]">
        <button
          onClick={onOpen}
          title="Ver la ficha"
          className="absolute inset-0 w-full h-full"
        >
          {img ? (
            <Image
              src={img}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-3xl">
              🎲
            </span>
          )}
        </button>
        {item.keepScore && (
          <span
            className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow pointer-events-none"
            style={{ backgroundColor: KEEP_HEX[item.keepScore] }}
            title={KEEP_LABELS[item.keepScore]}
          >
            {KEEP_EMOJI[item.keepScore]}
          </span>
        )}
        <ShowcaseStar
          showcased={item.showcased}
          readOnly={readOnly}
          onToggle={onToggleShowcase}
          floating
        />
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        <button onClick={onOpen} className="text-left">
          <h3 className="text-xs font-semibold text-[var(--text)] line-clamp-2 hover:text-[var(--primary)] transition-colors">
            {item.name}
          </h3>
        </button>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>🎲 {item.numPlays}</span>
          {item.userRating !== null && (
            <span className="text-[var(--primary)]">★ {item.userRating}</span>
          )}
          {item.expansions.length > 0 && <span>+{item.expansions.length} exp.</span>}
        </div>
        <div className="mt-auto pt-1">
          {readOnly ? (
            <KeepBadge score={item.keepScore} />
          ) : (
            <KeepScoreSlider value={item.keepScore} onChange={onScore} compact />
          )}
        </div>
      </div>
    </div>
  );
}

export function DetailModal({
  item,
  onClose,
  onScore,
  onExpansionScore,
  onToggleShowcase,
  readOnly = false,
  owner,
}: {
  item: CollectionItemView;
  onClose: () => void;
  onScore: (score: number | null) => void;
  onExpansionScore: (bggId: number, score: number | null) => void;
  onToggleShowcase: () => void;
  readOnly?: boolean;
  owner?: string;
}) {
  const img = cover(item);

  // Cerrar con Escape: la ficha se abre y se cierra muchas veces seguidas
  // mientras repasas la colección.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-[var(--surface-hover)] flex items-center justify-center">
              {img ? (
                <Image
                  src={img}
                  alt={item.name}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">🎲</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--text)] leading-snug">{item.name}</h2>
              <div className="mt-2">
                <GameMeta item={item} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                {item.bggRating !== null && <BggRating rating={item.bggRating} size={30} />}
                {item.userRating !== null && (
                  <MyRatingBadge rating={item.userRating} owner={owner} />
                )}
                <a
                  href={`https://boardgamegeek.com/boardgame/${item.bggId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--primary)] hover:underline"
                >
                  Ver en BGG ↗
                </a>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              {readOnly
                ? `¿Se queda en la colección${owner ? ` de ${owner}` : ""}?`
                : "¿Se queda en tu colección?"}
            </p>
            {readOnly ? (
              <KeepBadge score={item.keepScore} />
            ) : (
              <KeepScoreSlider value={item.keepScore} onChange={onScore} />
            )}
          </div>

          {item.expansions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Expansiones · heredan la puntuación del juego base salvo que tengan
                una propia
              </p>
              <div className="space-y-2">
                {item.expansions.map((exp) => (
                  <div
                    key={exp.bggId}
                    className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-[var(--text)] truncate">{exp.name}</span>
                      {exp.numPlays > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                          🎲 {exp.numPlays}
                        </span>
                      )}
                    </div>
                    {readOnly ? (
                      <KeepBadge
                        score={exp.ownKeepScore ?? item.keepScore}
                        inherited={exp.ownKeepScore === null}
                      />
                    ) : (
                      <KeepScoreSlider
                        value={exp.ownKeepScore ?? item.keepScore}
                        onChange={(score) => onExpansionScore(exp.bggId, score)}
                        inherited={exp.ownKeepScore === null}
                        inheritedFrom={item.name}
                        compact
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!readOnly && (
            <button
              onClick={onToggleShowcase}
              className={`mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                item.showcased
                  ? "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]/40"
                  : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
              }`}
            >
              {item.showcased
                ? "⭐ En la vitrina de tu perfil"
                : "☆ Añadir a la vitrina de tu perfil"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Esqueleto con la forma de la vista activa: así la página no salta cuando
// llegan los datos y se entiende de un vistazo qué se está cargando.
export function CollectionSkeleton({ view }: { view: CollectionView }) {
  if (view === "shelf") {
    return (
      <div className="shelf-wrap">
        <div className="shelf">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="shelf-slot">
              <div className="shelf-box w-[72px] h-[92px] bg-black/20 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-[var(--surface-hover)]" />
            <div className="p-2.5 space-y-2">
              <div className="h-3 w-3/4 rounded bg-[var(--surface-hover)]" />
              <div className="h-2 w-1/2 rounded bg-[var(--surface-hover)]" />
              <div className="h-1.5 w-full rounded bg-[var(--surface-hover)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-3 animate-pulse"
        >
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-[var(--surface-hover)] shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3.5 w-1/3 rounded bg-[var(--surface-hover)]" />
              <div className="h-2.5 w-2/3 rounded bg-[var(--surface-hover)]" />
            </div>
            <div className="hidden sm:block w-44 h-6 self-center rounded bg-[var(--surface-hover)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
