"use client";

import { useState, useEffect, useCallback } from "react";

// Dot positions for each die face (1-6), centered in a 28x28 box offset at x=204, y=8
const dieFaces: Record<number, { cx: number; cy: number }[]> = {
  1: [{ cx: 218, cy: 22 }],
  2: [
    { cx: 212, cy: 16 },
    { cx: 224, cy: 28 },
  ],
  3: [
    { cx: 212, cy: 16 },
    { cx: 218, cy: 22 },
    { cx: 224, cy: 28 },
  ],
  4: [
    { cx: 212, cy: 16 },
    { cx: 224, cy: 16 },
    { cx: 212, cy: 28 },
    { cx: 224, cy: 28 },
  ],
  5: [
    { cx: 212, cy: 16 },
    { cx: 224, cy: 16 },
    { cx: 218, cy: 22 },
    { cx: 212, cy: 28 },
    { cx: 224, cy: 28 },
  ],
  6: [
    { cx: 212, cy: 15 },
    { cx: 224, cy: 15 },
    { cx: 212, cy: 22 },
    { cx: 224, cy: 22 },
    { cx: 212, cy: 29 },
    { cx: 224, cy: 29 },
  ],
};

export default function AnimatedLogo() {
  const [face, setFace] = useState(3);
  const [shaking, setShaking] = useState(false);

  const rollDice = useCallback(() => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => {
      setFace((prev) => {
        let next = prev;
        while (next === prev) {
          next = Math.floor(Math.random() * 6) + 1;
        }
        return next;
      });
      setShaking(false);
    }, 600);
  }, [shaking]);

  useEffect(() => {
    const interval = setInterval(rollDice, 30000);
    return () => clearInterval(interval);
  }, [rollDice]);

  const dots = dieFaces[face];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-4 2 248 44"
      fill="none"
      width={168}
      height={33}
      role="img"
      aria-label="BG Planner"
    >
      <style>{`
        @keyframes dice-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-2px, -1px) rotate(-6deg); }
          20% { transform: translate(2px, 1px) rotate(6deg); }
          30% { transform: translate(-1px, 2px) rotate(-4deg); }
          40% { transform: translate(1px, -2px) rotate(4deg); }
          50% { transform: translate(-2px, 1px) rotate(-6deg); }
          60% { transform: translate(2px, -1px) rotate(6deg); }
          70% { transform: translate(-1px, -2px) rotate(-3deg); }
          80% { transform: translate(1px, 2px) rotate(3deg); }
          90% { transform: translate(-1px, -1px) rotate(-2deg); }
        }
        .dice-shaking {
          animation: dice-shake 0.6s ease-in-out;
          transform-origin: 218px 22px;
        }
      `}</style>
      <text
        x="0"
        y="36"
        fontFamily="var(--font-display), system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        letterSpacing="-1.5"
      >
        <tspan fill="var(--primary)">BG</tspan>
        <tspan fill="currentColor"> Planner</tspan>
      </text>
      <g
        className={shaking ? "dice-shaking" : ""}
        onMouseEnter={() => rollDice()}
        style={{ cursor: "pointer" }}
      >
        <rect x="204" y="8" width="28" height="28" rx="6" fill="var(--primary)" opacity="0.12" />
        {dots.map((dot, i) => (
          <circle key={`${face}-${i}`} cx={dot.cx} cy={dot.cy} r="2.2" fill="var(--primary)" />
        ))}
      </g>
    </svg>
  );
}
