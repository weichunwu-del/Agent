type Props = { heading: number };

export function YawCompass({ heading }: Props) {
  const ticks = [];
  for (let i = 0; i < 36; i++) {
    const a = (i * 10 * Math.PI) / 180;
    const outer = 54;
    const inner = i % 3 === 0 ? 45 : i % 3 === 1 ? 49 : 51;
    const x1 = 70 + Math.sin(a) * inner;
    const y1 = 70 - Math.cos(a) * inner;
    const x2 = 70 + Math.sin(a) * outer;
    const y2 = 70 - Math.cos(a) * outer;
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#fff"
        strokeWidth={i % 3 === 0 ? 1.7 : 0.9}
        strokeLinecap="round"
        opacity={i % 3 === 0 ? 0.95 : 0.45}
      />,
    );
  }

  const labels: { t: string; d: number; size: number }[] = [
    { t: "N", d: 0, size: 11 },
    { t: "3", d: 30, size: 9 },
    { t: "6", d: 60, size: 9 },
    { t: "E", d: 90, size: 11 },
    { t: "12", d: 120, size: 9 },
    { t: "15", d: 150, size: 9 },
    { t: "S", d: 180, size: 11 },
    { t: "21", d: 210, size: 9 },
    { t: "24", d: 240, size: 9 },
    { t: "W", d: 270, size: 11 },
    { t: "30", d: 300, size: 9 },
    { t: "33", d: 330, size: 9 },
  ];

  return (
    <div className="yaw-gauge" title={`无人机偏航角 ${heading.toFixed(1)}°`}>
      <div className="yaw-readout">{heading.toFixed(1)}°</div>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs>
          <radialGradient id="yawBg" cx="50%" cy="46%">
            <stop offset="0%" stopColor="rgba(18,28,42,0.28)" />
            <stop offset="70%" stopColor="rgba(8,12,20,0.62)" />
            <stop offset="100%" stopColor="rgba(6,10,16,0.78)" />
          </radialGradient>
        </defs>
        <circle cx="70" cy="70" r="58" fill="url(#yawBg)" stroke="#8ed7ff" strokeWidth="1.7" />
        <circle cx="70" cy="70" r="41.5" fill="none" stroke="rgba(255,255,255,0.12)" />
        <g transform={`rotate(${-heading} 70 70)`}>
          {ticks}
          {labels.map((l) => {
            const a = (l.d * Math.PI) / 180;
            const r = 36;
            const x = 70 + Math.sin(a) * r;
            const y = 70 - Math.cos(a) * r;
            return (
              <text
                key={l.t}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={l.size}
                fontWeight={800}
                fontFamily="Arial, sans-serif"
                transform={`rotate(${l.d} ${x} ${y})`}
              >
                {l.t}
              </text>
            );
          })}
        </g>
        <rect x="68.1" y="8" width="3.8" height="11" rx="1" fill="#7CFF6B" />
        <polygon points="70,22 75.2,27.2 73.2,27.2 73.2,33 66.8,33 66.8,27.2 64.8,27.2" fill="#4aa7ff" />
        <line x1="11" y1="70" x2="23" y2="70" stroke="#ff3b3b" strokeWidth="2.6" strokeLinecap="round" />
        <line x1="117" y1="70" x2="129" y2="70" stroke="#ff3b3b" strokeWidth="2.6" strokeLinecap="round" />
        <g transform="translate(70,72)">
          <path
            d="M0,-15.5 L5.2,-1.2 L13.5,5.2 L13.5,7.4 L3.6,3.2 L2.3,13.8 L-2.3,13.8 L-3.6,3.2 L-13.5,7.4 L-13.5,5.2 L-5.2,-1.2 Z"
            fill="#9fd4f8"
            stroke="#dff4ff"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

export function PitchLadder({ pitch }: { pitch: number }) {
  const clamped = Math.max(-90, Math.min(30, pitch));
  const y = 50 + ((-clamped) / 90) * 40;
  return (
    <div className="pitch-gauge" title={`云台俯仰角 ${pitch.toFixed(0)}°`}>
      <div className="pitch-ticks" />
      <div className="pitch-green" style={{ top: `${y}%`, transform: "translateY(-50%)" }} />
      <div className="pitch-badge" style={{ top: `${y}%`, transform: "translateY(-50%)" }}>
        {pitch.toFixed(0)}°
      </div>
    </div>
  );
}
