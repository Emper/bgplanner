"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import BggRating from "@/components/BggRating";
import GameTags from "@/components/GameTags";
import Alert from "@/components/ui/Alert";
import Button, { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Notice } from "@/components/ui/EmptyState";
import GameThumb from "@/components/ui/GameThumb";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Spinner from "@/components/ui/Spinner";
import { Chip } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { bggGameUrl } from "@/lib/bggLinks";
import { fitsWeight } from "@/lib/gameLabels";
import type {
  RecommendationsResponse,
  RecommendationsStatus,
  RecommendedGame,
} from "@/lib/recommendationTypes";

// Cuántas tarjetas de "Para ti" se ven de entrada y cuántas añade "Ver más".
const FOR_YOU_BATCH = 9;

type Players = "" | "1" | "2" | "3" | "4" | "5";
type Weight = "" | "light" | "medium" | "heavy";

const PLAYER_OPTIONS: { value: Players; label: string }[] = [
  { value: "", label: "Cualquiera" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5+" },
];

const WEIGHT_OPTIONS: { value: Weight; label: string }[] = [
  { value: "", label: "Cualquiera" },
  { value: "light", label: "Ligeros" },
  { value: "medium", label: "Medios" },
  { value: "heavy", label: "Duros" },
];

function matches(game: RecommendedGame, players: Players, weight: Weight): boolean {
  if (players) {
    const n = Number(players);
    const min = game.minPlayers ?? 1;
    const max = game.maxPlayers ?? 99;
    if (n === 5 ? max < 5 : n < min || n > max) return false;
  }
  if (!fitsWeight(game.weight, weight)) return false;
  return true;
}

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<RecommendationsStatus | null>(null);
  const [phase, setPhase] = useState<"history" | "taste" | null>(null);
  const toast = useToast();

  const [players, setPlayers] = useState<Players>("");
  const [weight, setWeight] = useState<Weight>("");
  const [forYouShown, setForYouShown] = useState(FOR_YOU_BATCH);

  // Lo que has tocado en esta visita: guardado en la wishlist o descartado.
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Set<number>>(new Set());

  // ── Carga ─────────────────────────────────────────────────────────────

  const load = useCallback(async (): Promise<RecommendationsResponse | null> => {
    try {
      const res = await fetch("/api/recommendations", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar las recomendaciones");
      setData(json);
      if (json.status) setStatus(json.status);
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      return null;
    }
  }, []);

  // Primero recomendamos con lo que ya sabemos y, solo si hace falta,
  // preparamos en segundo plano lo que falte: tu historial de BGG (una vez
  // por semana) y de qué van tus juegos nuevos. Buscar candidatos nuevos es
  // cosa del cron nocturno, no de cada visita. Al terminar se recalcula.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = await load();
      if (cancelled || !first?.connected || !first.status) return;
      const s = first.status;
      if (!s.historyStale && s.tasteMissing === 0) return;
      // Antes de la primera respuesta, para no enseñar un "no hay nada" que
      // va a dejar de ser verdad en unos segundos.
      setPhase(s.historyStale ? "history" : "taste");

      let worked = false;
      // Tope de seguridad por si algo se queda dando vueltas.
      for (let i = 0; i < 40 && !cancelled; i++) {
        try {
          const res = await fetch("/api/recommendations/prepare", {
            method: "POST",
            credentials: "include",
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "BGG no ha respondido");
          if (cancelled) return;
          setStatus(json.status);
          if (json.step === "done") break;
          worked = true;
          setPhase(json.step);
        } catch (err) {
          if (!cancelled) {
            toast(`${err instanceof Error ? err.message : "BGG no ha respondido"}. Te recomendamos con lo que ya teníamos.`);
          }
          break;
        }
      }
      if (!cancelled) {
        setPhase(null);
        if (worked) await load();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, toast]);

  // ── Acciones ──────────────────────────────────────────────────────────

  const setFlag = async (
    bggId: number,
    flag: "wishlist" | "dismissed" | null
  ): Promise<boolean> => {
    setBusy((prev) => new Set(prev).add(bggId));
    try {
      const res = await fetch(`/api/recommendations/${bggId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flag }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "No se ha podido guardar");
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido guardar");
      return false;
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(bggId);
        return next;
      });
    }
  };

  const toggleSet = (
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    bggId: number,
    on: boolean
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(bggId);
      else next.delete(bggId);
      return next;
    });

  const toggleWishlist = async (game: RecommendedGame) => {
    const wasSaved = saved.has(game.bggId);
    toggleSet(setSaved, game.bggId, !wasSaved);
    const ok = await setFlag(game.bggId, wasSaved ? null : "wishlist");
    if (!ok) {
      toggleSet(setSaved, game.bggId, wasSaved);
      return;
    }
    if (!wasSaved) {
      toast(`${game.name} está en tu wishlist, dentro de «Mi colección»`);
    }
  };

  const dismiss = async (game: RecommendedGame) => {
    toggleSet(setDismissed, game.bggId, true);
    toggleSet(setSaved, game.bggId, false);
    const ok = await setFlag(game.bggId, "dismissed");
    if (!ok) {
      toggleSet(setDismissed, game.bggId, false);
      return;
    }
    toast(`No volveremos a recomendarte ${game.name}`, {
      action: {
        label: "Deshacer",
        onClick: async () => {
          toggleSet(setDismissed, game.bggId, false);
          const undone = await setFlag(game.bggId, null);
          if (!undone) toggleSet(setDismissed, game.bggId, true);
        },
      },
    });
  };

  // ── Lo que se ve ──────────────────────────────────────────────────────

  const visible = useCallback(
    (games: RecommendedGame[]) =>
      games.filter((g) => !dismissed.has(g.bggId) && matches(g, players, weight)),
    [dismissed, players, weight]
  );

  const forYou = useMemo(() => (data ? visible(data.forYou) : []), [data, visible]);
  const rows = useMemo(
    () =>
      (data?.becauseYouLiked ?? [])
        .map((row) => ({ ...row, games: visible(row.games) }))
        .filter((row) => row.games.length > 0),
    [data, visible]
  );

  const filtering = players !== "" || weight !== "";
  const loading = !data && !error;
  const nothing = data?.connected && data.forYou.length === 0 && data.becauseYouLiked.length === 0;

  // ── Sin BGG ───────────────────────────────────────────────────────────

  if (data && !data.connected) {
    return (
      <PageShell nav={<Navbar />} width="form">
        <Notice
          icon="✨"
          title="Recomendaciones"
          actions={<ButtonLink href="/profile">Conectar mi cuenta de BGG</ButtonLink>}
        >
          <p>
            Conecta tu usuario de BoardGameGeek y te recomendaremos juegos
            que no tienes a partir de los que te gustan.
          </p>
        </Notice>
      </PageShell>
    );
  }

  return (
    <PageShell nav={<Navbar />} width="wide">
      <PageHeader
        back={{ href: "/collection", label: "Mi colección" }}
        title="Recomendaciones para ti"
        lead="Juegos que no tienes, no has tenido y no has jugado, elegidos a partir de tu colección y tus valoraciones."
      />

      {phase && status && <PrepBanner phase={phase} status={status} />}

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading && <Skeleton />}

      {nothing && !phase && <NothingYet status={data.status} />}

      {data && !nothing && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
            <ChipGroup
              label="Jugadores"
              options={PLAYER_OPTIONS}
              value={players}
              onChange={(v) => {
                setPlayers(v);
                setForYouShown(FOR_YOU_BATCH);
              }}
            />
            <ChipGroup
              label="Peso"
              options={WEIGHT_OPTIONS}
              value={weight}
              onChange={(v) => {
                setWeight(v);
                setForYouShown(FOR_YOU_BATCH);
              }}
            />
          </div>

          <section className="mb-10">
            <h2 className="text-lg font-bold text-[var(--text)]">Para ti</h2>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              En base a tus gustos, échales un vistazo.
            </p>
            {forYou.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-6 text-center">
                {filtering
                  ? "Nada con esos filtros. Prueba a quitar alguno."
                  : "Ya lo has descartado todo. Vuelve otro día, que seguimos buscando."}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {forYou.slice(0, forYouShown).map((game) => (
                    <RecCard
                      key={game.bggId}
                      game={game}
                      saved={saved.has(game.bggId)}
                      busy={busy.has(game.bggId)}
                      onToggleWishlist={() => toggleWishlist(game)}
                      onDismiss={() => dismiss(game)}
                    />
                  ))}
                </div>
                {forYou.length > forYouShown && (
                  <div className="text-center mt-4">
                    <Button variant="secondary" onClick={() => setForYouShown((n) => n + FOR_YOU_BATCH)}>
                      Ver más
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {rows.map((row) => (
            <section key={row.anchor.bggId} className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <GameThumb src={row.anchor.thumbnail} name={row.anchor.name} size="sm" />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[var(--text)] leading-tight">
                    Si te gustó <span className="text-[var(--primary)]">{row.anchor.name}</span>…
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">{row.anchor.why}</p>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
                {row.games.map((game) => (
                  <div key={game.bggId} className="snap-start shrink-0 w-[260px] flex">
                    <RecCard
                      game={game}
                      compact
                      saved={saved.has(game.bggId)}
                      busy={busy.has(game.bggId)}
                      onToggleWishlist={() => toggleWishlist(game)}
                      onDismiss={() => dismiss(game)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {status && (
            <p className="text-center text-[11px] text-[var(--text-muted)] mt-2">
              Hemos usado {status.tasteCount} juegos tuyos para conocer tus
              gustos y elegido entre {status.poolSize.toLocaleString("es-ES")} juegos.
              {status.poolMissing > 0 && " Cada día estudiamos más, así que vuelve de vez en cuando."}
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}

// ── Tarjeta de un juego recomendado ─────────────────────────────────────

function RecCard({
  game,
  saved,
  busy,
  compact = false,
  onToggleWishlist,
  onDismiss,
}: {
  game: RecommendedGame;
  saved: boolean;
  busy: boolean;
  compact?: boolean;
  onToggleWishlist: () => void;
  onDismiss: () => void;
}) {
  const img = game.image || game.thumbnail;

  return (
    // En móvil la tarjeta de "Para ti" va en horizontal (portada a la
    // izquierda): en vertical, nueve juegos eran un scroll interminable.
    <article
      className={`w-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] overflow-hidden flex ${
        compact ? "flex-col" : "flex-row sm:flex-col"
      }`}
    >
      <div
        className={`relative bg-[var(--surface-hover)] ${
          compact ? "aspect-[16/10]" : "w-28 shrink-0 sm:w-auto sm:aspect-[16/9]"
        }`}
      >
        {img ? (
          <Image
            src={img}
            alt={game.name}
            fill
            sizes="(max-width: 640px) 112px, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-4xl">🎲</span>
        )}
        <button
          onClick={onDismiss}
          disabled={busy}
          title="No me interesa"
          aria-label={`No me interesa ${game.name}`}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-xs text-white/80 hover:text-white disabled:opacity-50 transition-colors"
        >
          ✕
        </button>
        {game.bggRating !== null && (
          <div className="absolute bottom-2 right-2">
            <BggRating rating={game.bggRating} size={32} />
          </div>
        )}
      </div>

      <div className="p-3 flex-1 min-w-0 flex flex-col gap-2">
        <div>
          <a
            href={bggGameUrl(game.bggId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm text-[var(--text)] hover:text-[var(--primary)] transition-colors line-clamp-2"
          >
            {game.name}
            {game.yearPublished && (
              <span className="font-normal text-[var(--text-muted)] ml-1">
                ({game.yearPublished})
              </span>
            )}
          </a>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <GameTags
              game={{
                bggRank: game.bggRank,
                minPlayers: game.minPlayers,
                maxPlayers: game.maxPlayers,
                playingTime: game.playingTime,
                weight: game.weight,
              }}
            />
          </div>
        </div>

        {game.because && (
          <div className="text-xs text-[var(--text-secondary)]">
            {game.communityFans >= 2 ? (
              <p>
                A {game.communityFans} jugadores de BG Planner que adoran{" "}
                <strong className="text-[var(--text)]">{game.because.name}</strong> también
                les encanta este.
              </p>
            ) : !compact ? (
              <p>
                {game.because.liked ? "Porque te gustó" : "Porque tienes ganas de jugar a"}{" "}
                <strong className="text-[var(--text)]">{game.because.name}</strong>
              </p>
            ) : null}
            {game.traits.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {game.traits.map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--primary)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-1">
          <Button variant={saved ? "soft" : "primary"} size="sm" block onClick={onToggleWishlist} disabled={busy}>
            {saved ? "✓ En tu wishlist" : "♡ Añadir a la wishlist"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-[var(--text-muted)] mr-0.5">{label}</span>
      {options.map((o) => (
        <Chip key={o.value || "any"} size="sm" active={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

// ── Estados ─────────────────────────────────────────────────────────────

function PrepBanner({
  phase,
  status,
}: {
  phase: "history" | "taste";
  status: RecommendationsStatus;
}) {
  const total = status.tasteCount + status.tasteMissing;
  const { title, text, progress } =
    phase === "history"
      ? {
          title: "Repasando lo que has jugado y puntuado en BGG…",
          text: "Así no te recomendamos nada que ya conozcas.",
          progress: undefined,
        }
      : {
          title: `Estudiando tus juegos… quedan ${status.tasteMissing}`,
          text: "Le preguntamos a BGG de qué va cada uno para entender qué te gusta. Solo hace falta la primera vez y cuando llegan juegos nuevos.",
          progress: total > 0 ? status.tasteCount / total : 0,
        };

  return (
    <div role="status" className="mb-4 rounded-2xl border border-[var(--primary)]/30 bg-[var(--accent-soft)] p-4">
      <div className="flex items-start gap-3">
        <Spinner size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--primary)]">{title}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{text}</p>
          {progress !== undefined && (
            <div className="mt-2 h-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NothingYet({ status }: { status: RecommendationsStatus }) {
  const noTaste = status.tasteCount === 0;
  return (
    <EmptyState
      variant="card"
      icon={noTaste ? "🧭" : "🔭"}
      title={noTaste ? "Aún no sabemos qué te gusta" : "Todavía no tenemos nada para ti"}
      description={
        noTaste
          ? "Puntúa algunos juegos en BGG o dinos en tu colección cuáles no se irán nunca, y vuelve: con eso ya podemos empezar."
          : "Seguimos estudiando juegos para encontrarte algo que no conozcas. Vuelve en un rato."
      }
      action={noTaste && <ButtonLink href="/collection">Ir a mi colección</ButtonLink>}
    />
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden animate-pulse"
        >
          <div className="aspect-[16/9] bg-[var(--surface-hover)]" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-[var(--surface-hover)]" />
            <div className="h-2.5 w-1/2 rounded bg-[var(--surface-hover)]" />
            <div className="h-8 w-full rounded-xl bg-[var(--surface-hover)] mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
