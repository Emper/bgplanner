"use client";

// Deterministic color from string — same name always gets same color
const COLORS = [
  "bg-red-800 text-red-200",
  "bg-amber-800 text-amber-200",
  "bg-emerald-800 text-emerald-200",
  "bg-blue-800 text-blue-200",
  "bg-purple-800 text-purple-200",
  "bg-pink-800 text-pink-200",
  "bg-cyan-800 text-cyan-200",
  "bg-orange-800 text-orange-200",
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
