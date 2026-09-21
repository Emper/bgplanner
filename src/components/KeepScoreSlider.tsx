"use client";

import { KEEP_EMOJI, KEEP_HEX, KEEP_LABELS, KEEP_SCORES } from "@/lib/collection";

interface Props {
  /** null = sin valorar. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** La puntuación viene del juego base, no es propia de este juego. */
  inherited?: boolean;
  /** Nombre del juego del que hereda, para explicarlo en la interfaz. */
  inheritedFrom?: string;
  disabled?: boolean;
  /** Versión reducida, sin la fila de números (para tarjetas apretadas). */
  compact?: boolean;
}

// Slider de permanencia: de "quiero venderlo" a "no se irá nunca". El 0 del
// recorrido es "sin valorar", así que se puede quitar la puntuación
// arrastrando hasta el principio sin necesidad de un botón de borrar.
export default function KeepScoreSlider({
  value,
  onChange,
  inherited = false,
  inheritedFrom,
  disabled = false,
  compact = false,
}: Props) {
  const current = value ?? 0;
  const color = value ? KEEP_HEX[value] : "var(--text-muted)";
  const pct = (current / 5) * 100;

  const label = value
    ? `${KEEP_EMOJI[value]} ${KEEP_LABELS[value]}`
    : "Sin valorar";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className="text-xs font-semibold truncate"
          style={{ color: value ? color : "var(--text-muted)" }}
        >
          {label}
        </span>
        {inherited && value !== null && (
          <span
            className="text-[10px] text-[var(--text-muted)] shrink-0"
            title={
              inheritedFrom
                ? `Hereda la puntuación de "${inheritedFrom}"`
                : "Hereda la puntuación del juego base"
            }
          >
            heredada
          </span>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={5}
        step={1}
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const next = parseInt(e.target.value, 10);
          onChange(next === 0 ? null : next);
        }}
        className={`keep-slider ${disabled ? "opacity-50" : ""}`}
        style={
          {
            "--keep-color": color,
            "--keep-track": `linear-gradient(to right, ${
              value ? color : "var(--input-border)"
            } 0%, ${
              value ? color : "var(--input-border)"
            } ${pct}%, var(--input-border) ${pct}%, var(--input-border) 100%)`,
          } as React.CSSProperties
        }
        aria-label="Puntuación de permanencia"
        aria-valuetext={label}
      />

      {!compact && (
        <div className="flex items-center justify-between mt-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            title="Quitar la puntuación"
            className={`w-6 h-5 text-[10px] rounded transition-colors ${
              value === null
                ? "text-[var(--text)] font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            –
          </button>
          {KEEP_SCORES.map((score) => (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value === score ? null : score)}
              title={`${score}. ${KEEP_LABELS[score]}`}
              className={`w-6 h-5 text-[10px] rounded transition-colors ${
                value === score
                  ? "font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
              style={value === score ? { color } : undefined}
            >
              {score}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
