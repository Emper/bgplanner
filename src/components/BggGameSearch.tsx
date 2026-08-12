"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface SearchResult {
  bggId: number;
  name: string;
  yearPublished: number | null;
  thumbnail?: string | null;
}

interface GameDetails {
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  bggRating: number | null;
  weight: number | null;
}

interface Props {
  onSelect: (game: GameDetails) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BggGameSearch({ onSelect, placeholder = "Buscar juego en BGG...", disabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGame, setLoadingGame] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const abortController = new AbortController();

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bgg/search?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          const top = data.slice(0, 20);
          setResults(top);
          setIsOpen(true);

          // Fase 2: pedir las imágenes que falten y rellenarlas al llegar.
          const missing = top.filter((r) => !r.thumbnail).map((r) => r.bggId);
          if (missing.length > 0) {
            fetch(`/api/bgg/thumbnails?ids=${missing.join(",")}`, {
              signal: abortController.signal,
            })
              .then((r) => (r.ok ? r.json() : {}))
              .then((thumbs: Record<number, string>) => {
                setResults((prev) =>
                  prev.map((r) =>
                    thumbs[r.bggId] ? { ...r, thumbnail: thumbs[r.bggId] } : r
                  )
                );
              })
              .catch(() => {
                /* ignore (incluye AbortError) */
              });
          }
        }
      } catch {
        // ignore (includes AbortError)
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortController.abort();
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = async (result: SearchResult) => {
    setLoadingGame(result.bggId);
    try {
      const res = await fetch(`/api/bgg/game/${result.bggId}`);
      if (res.ok) {
        const game = await res.json();
        onSelect(game);
      } else {
        // BGG detail fetch failed — use basic search data
        onSelect({
          bggId: result.bggId,
          name: result.name,
          thumbnail: null,
          yearPublished: result.yearPublished,
          minPlayers: null,
          maxPlayers: null,
          playingTime: null,
          bggRating: null,
          weight: null,
        });
      }
      setQuery("");
      setResults([]);
      setIsOpen(false);
    } catch {
      // ignore
    } finally {
      setLoadingGame(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] text-sm transition-all duration-200"
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-[var(--primary)] text-xs animate-pulse">Buscando...</div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.bggId}
              onClick={() => handleSelect(r)}
              disabled={loadingGame === r.bggId}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)]/50 last:border-0 disabled:opacity-50 flex items-center gap-3"
            >
              <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-[var(--surface-hover)]">
                {r.thumbnail ? (
                  <Image
                    src={r.thumbnail}
                    alt={r.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
                    ?
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text)] truncate">
                  {r.name}
                  {r.yearPublished && (
                    <span className="text-[var(--text-muted)] ml-1">({r.yearPublished})</span>
                  )}
                </div>
                {loadingGame === r.bggId && (
                  <div className="text-xs text-[var(--primary)] mt-0.5 animate-pulse">Añadiendo juego...</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 p-3 text-sm text-[var(--text-secondary)]">
          No se encontraron resultados
        </div>
      )}
    </div>
  );
}
