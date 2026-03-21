"use client";

import { useState, useEffect, useCallback } from "react";

// Dot positions for each die face (1-6), centered in a 28x28 box offset at x=164, y=8
const dieFaces: Record<number, { cx: number; cy: number }[]> = {
  1: [{ cx: 178, cy: 22 }],
  2: [
    { cx: 172, cy: 16 },
    { cx: 184, cy: 28 },
  ],
  3: [
    { cx: 172, cy: 16 },
    { cx: 178, cy: 22 },
    { cx: 184, cy: 28 },
  ],
  4: [
    { cx: 172, cy: 16 },
    { cx: 184, cy: 16 },
    { cx: 172, cy: 28 },
    { cx: 184, cy: 28 },
  ],
  5: [
    { cx: 172, cy: 16 },
    { cx: 184, cy: 16 },
    { cx: 178, cy: 22 },
    { cx: 172, cy: 28 },
    { cx: 184, cy: 28 },
  ],
  6: [
    { cx: 172, cy: 15 },
    { cx: 184, cy: 15 },
    { cx: 172, cy: 22 },
    { cx: 184, cy: 22 },
    { cx: 172, cy: 29 },
    { cx: 184, cy: 29 },
  ],
};

export default function AnimatedLogo() {
  const [face, setFace] = useState(3);
  const [shaking, setShaking] = useState(false);

  const rollDice = useCallback(() => {
    setShaking(true);
    // After shake animation ends (600ms), change the face
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
  }, []);

  useEffect(() => {
    const interval = setInterval(rollDice, 30000);
    return () => clearInterval(interval);
  }, [rollDice]);

  const dots = dieFaces[face];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 48"
      fill="none"
      width={120}
      height={28}
      role="img"
      aria-label="WeBoard"
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
          transform-origin: 178px 22px;
        }
      `}</style>
      <text
        x="0"
        y="36"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="36"
        fontWeight="800"
        letterSpacing="-1"
      >
        <tspan fill="#f59e0b">We</tspan>
        <tspan fill="#e2e8f0">Board</tspan>
      </text>
      <g className={shaking ? "dice-shaking" : ""}>
        <rect x="164" y="8" width="28" height="28" rx="5" fill="#f59e0b" opacity="0.15" />
        {dots.map((dot, i) => (
          <circle key={`${face}-${i}`} cx={dot.cx} cy={dot.cy} r="2" fill="#f59e0b" />
        ))}
      </g>
    </svg>
  );
}
