"use client";

// Deterministic color from string — same name always gets same color
const COLORS = [
  "bg-red-500/20 text-red-300",
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-blue-500/20 text-blue-300",
  "bg-purple-500/20 text-purple-300",
  "bg-pink-500/20 text-pink-300",
  "bg-cyan-500/20 text-cyan-300",
  "bg-orange-500/20 text-orange-300",
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitial(name: string) {
  return (name[0] || "?").toUpperCase();
}

interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export default function Avatar({ name, avatarUrl, size = "md", className = "" }: Props) {
  const sizeClass = SIZES[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0 ${getColor(name)} ${className}`}>
      {getInitial(name)}
    </div>
  );
}
