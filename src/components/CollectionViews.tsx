"use client";

import Image from "next/image";
import { useRef } from "react";
import BggRating from "@/components/BggRating";
import KeepScoreSlider from "@/components/KeepScoreSlider";
import {
  KEEP_CLASSES,
  KEEP_EMOJI,
  KEEP_HEX,
  KEEP_LABELS,
  type CollectionItemView,
} from "@/lib/collection";
import GameTags, { GameTag } from "@/components/GameTags";
import Button, { buttonClass, CloseButton } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import GameThumb from "@/components/ui/GameThumb";
import Modal from "@/components/ui/Modal";
import { bggGameUrl } from "@/lib/bggLinks";
import { plural } from "@/lib/text";

// Las tarjetas de la colección (lista y cuadrícula) y la ficha de un juego.
// La tercera vista, la estantería, es GameShelf, que se comparte con las
// vitrinas de los perfiles. Se usan en "Mi colección" y en la colección que
// otro te enseña desde su perfil; ahí van en modo lectura (`readOnly`), donde
// el slider se sustituye por la puntuación escrita. La permanencia es privada:
// a quien no es su amigo no le llega (`hideScores`) y no se pinta ni el hueco.

export type CollectionView = "list" | "grid" | "shelf";

// La portada grande solo llega tras resincronizar con BGG; hasta entonces
// tiramos del thumbnail de siempre.
function cover(item: { image: string | null; thumbnail: string | null }) {
  return item.image || item.thumbnail;
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

  const label = showcased
    ? "Quitar de la vitrina de tu perfil"
    : "Añadir a la vitrina de tu perfil";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={showcased}
      aria-label={label}
      title={label}
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

function GameMeta({ item, owner }: { item: CollectionItemView; owner?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <GameTags game={item} owner={owner} />
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
  hideScores = false,
  owner,
}: {
  item: CollectionItemView;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpen: () => void;
  onScore: (score: number | null) => void;
  onToggleShowcase?: () => void;
  readOnly?: boolean;
  hideScores?: boolean;
  owner?: string;
}) {
  return (
    <div
      className={cardClass({ padding: "sm" })}
      style={
        item.keepScore
          ? { borderLeft: `3px solid ${KEEP_HEX[item.keepScore]}` }
          : undefined
      }
    >
      <div className="flex gap-3">
        <button type="button" onClick={onOpen} className="shrink-0 rounded-xl" title="Ver la ficha">
          <GameThumb src={item.thumbnail} name={item.name} size="md" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button type="button" onClick={onOpen} className="text-left min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-[var(--text)] truncate hover:text-[var(--primary)] transition-colors">
                {item.name}
                {item.yearPublished && (
                  <span className="font-normal text-[var(--text-muted)] ml-1">
                    ({item.yearPublished})
                  </span>
                )}
              </h3>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <ShowcaseStar
                showcased={item.showcased}
                readOnly={readOnly}
                onToggle={onToggleShowcase}
              />
              {item.status === "wishlist" && (
                <GameTag
                  title={
                    item.savedHere
                      ? "Guardado en la wishlist de BG Planner"
                      : "Está en su wishlist de BGG"
                  }
                >
                  Lo quiere
                </GameTag>
              )}
              {item.bggRating !== null && <BggRating rating={item.bggRating} size={28} />}
            </div>
          </div>

          <div className="mt-1.5">
            <GameMeta item={item} owner={owner} />
          </div>

          {item.expansions.length > 0 && (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              className="mt-1.5 text-[11px] text-[var(--primary)] hover:underline"
            >
              <span aria-hidden>{expanded ? "▾" : "▸"}</span>{" "}
              {plural(item.expansions.length, "expansión", "expansiones")}
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

        {!hideScores && (
          <div className="hidden sm:flex w-44 shrink-0 self-center justify-end">
            {readOnly ? (
              <KeepBadge score={item.keepScore} />
            ) : (
              <KeepScoreSlider value={item.keepScore} onChange={onScore} />
            )}
          </div>
        )}
      </div>

      {!hideScores && (
        <div className="sm:hidden mt-2">
          {readOnly ? (
            <KeepBadge score={item.keepScore} />
          ) : (
            <KeepScoreSlider value={item.keepScore} onChange={onScore} />
          )}
        </div>
      )}
    </div>
  );
}

export function GridCard({
  item,
  onOpen,
  onScore,
  onToggleShowcase,
  readOnly = false,
  hideScores = false,
}: {
  item: CollectionItemView;
  onOpen: () => void;
  onScore: (score: number | null) => void;
  onToggleShowcase?: () => void;
  readOnly?: boolean;
  hideScores?: boolean;
}) {
  const img = cover(item);
  return (
    <div className={cardClass({ padding: "none", className: "overflow-hidden flex flex-col" })}>
      {/* La portada es un div y no un botón: dentro va la estrella, y un
          botón dentro de otro botón no es HTML válido. */}
      <div className="relative aspect-square bg-[var(--surface-hover)]">
        <button
          type="button"
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
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="text-xs font-semibold text-[var(--text)] line-clamp-2 hover:text-[var(--primary)] transition-colors">
            {item.name}
          </h3>
        </button>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>🎲 {item.numPlays}</span>
          {item.userRating !== null && (
            <span className="text-pink-700 dark:text-pink-300">♥ {item.userRating}</span>
          )}
          {item.expansions.length > 0 && <span>+{item.expansions.length} exp.</span>}
        </div>
        {!hideScores && (
          <div className="mt-auto pt-1">
            {readOnly ? (
              <KeepBadge score={item.keepScore} />
            ) : (
              <KeepScoreSlider value={item.keepScore} onChange={onScore} compact />
            )}
          </div>
        )}
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
  onRemoveSaved,
  readOnly = false,
  hideScores = false,
  owner,
}: {
  item: CollectionItemView;
  onClose: () => void;
  onScore: (score: number | null) => void;
  onExpansionScore: (bggId: number, score: number | null) => void;
  onToggleShowcase: () => void;
  /** Quitar de la wishlist de BG Planner (solo para los guardados aquí). */
  onRemoveSaved?: () => void;
  readOnly?: boolean;
  hideScores?: boolean;
  owner?: string;
}) {
  const img = cover(item);
  // El foco entra por la cabecera y no por el slider: con él enfocado, una
  // flecha del teclado cambiaría la puntuación sin querer.
  const headRef = useRef<HTMLDivElement>(null);

  // La cabecera es propia (portada, nombre y datos de BGG), así que el modal
  // va sin título ni ✕ de serie: la ✕ va en esa cabecera. Escape y pulsar
  // fuera cierran, que la ficha se abre y se cierra muchas veces seguidas.
  return (
    <Modal open onClose={onClose} size="lg" showClose={false} initialFocusRef={headRef}>
      <div ref={headRef} tabIndex={-1} className="flex items-start gap-4 outline-none">
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
          <h2 className="text-lg font-bold text-[var(--text)] leading-snug">
            {item.name}
            {item.yearPublished && (
              <span className="font-normal text-base text-[var(--text-muted)] ml-1.5">
                ({item.yearPublished})
              </span>
            )}
          </h2>
          <div className="mt-2">
            <GameMeta item={item} owner={owner} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            {item.bggRating !== null && <BggRating rating={item.bggRating} size={30} />}
            <a
              href={bggGameUrl(item.bggId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--primary)] hover:underline"
            >
              Ver en BGG ↗
            </a>
          </div>
        </div>
        <CloseButton onClick={onClose} className="-mr-1 -mt-1" />
      </div>

      {item.savedHere && !readOnly && (
        <div className="mt-5 p-4 rounded-xl bg-[var(--accent-soft)] border border-[var(--primary)]/30">
          <p className="text-xs text-[var(--text-secondary)]">
            Lo guardaste desde tus recomendaciones. BGG no deja apuntar
            cosas en tu wishlist desde fuera: añádelo allí también y lo
            tendrás en todas partes.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <a
              href={bggGameUrl(item.bggId)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ size: "xs" })}
            >
              Añadirlo en BGG ↗
            </a>
            {onRemoveSaved && (
              <Button variant="secondary" size="xs" onClick={onRemoveSaved}>
                Quitar de mi wishlist
              </Button>
            )}
          </div>
        </div>
      )}

      {!hideScores && (
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
      )}

      {item.expansions.length > 0 && (
        <div className={hideScores ? "mt-5" : "mt-4"}>
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
            {hideScores
              ? "Expansiones"
              : "Expansiones · heredan la puntuación del juego base salvo que tengan una propia"}
          </p>
          <div className="space-y-2">
            {item.expansions.map((exp) => (
              <div
                key={exp.bggId}
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]"
              >
                <div className={`flex items-center justify-between gap-2${hideScores ? "" : " mb-1"}`}>
                  <span className="text-xs text-[var(--text)] truncate">{exp.name}</span>
                  {exp.numPlays > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                      🎲 {exp.numPlays}
                    </span>
                  )}
                </div>
                {hideScores ? null : readOnly ? (
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
        <Button
          variant={item.showcased ? "soft" : "secondary"}
          block
          onClick={onToggleShowcase}
          aria-pressed={item.showcased}
          className="mt-4"
        >
          {item.showcased
            ? "⭐ En la vitrina de tu perfil"
            : "☆ Añadir a la vitrina de tu perfil"}
        </Button>
      )}
    </Modal>
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
