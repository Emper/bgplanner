import Image from "next/image";

// La portada pequeña de un juego en un listado, con el 🎲 de siempre si BGG
// no tiene imagen (antes unas pantallas ponían «?» y otras el dado).

const SIZES = {
  xs: { box: "w-8 h-8 rounded-md text-sm", px: 32 },
  sm: { box: "w-10 h-10 rounded-lg text-base", px: 40 },
  md: { box: "w-14 h-14 rounded-xl text-xl", px: 56 },
  lg: { box: "w-20 h-20 rounded-xl text-2xl", px: 80 },
};

export default function GameThumb({
  src,
  name,
  size = "md",
  fit = "cover",
  className = "",
}: {
  src: string | null | undefined;
  name: string;
  size?: keyof typeof SIZES;
  /** `contain` para no recortar cajas alargadas. */
  fit?: "cover" | "contain";
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div className={`${s.box} shrink-0 overflow-hidden bg-[var(--surface-hover)] flex items-center justify-center ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={name}
          width={s.px}
          height={s.px}
          className={`w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        />
      ) : (
        <span aria-hidden>🎲</span>
      )}
    </div>
  );
}
