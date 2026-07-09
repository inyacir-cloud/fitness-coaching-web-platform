"use client";

import { useState, useMemo } from "react";

type DataPoint = {
  date: string; // YYYY-MM-DD
  value: number;
};

interface Props {
  data: DataPoint[];
  label?: string;
  unit?: string;
  color?: string;
  height?: number;
}

export default function ProgressChart({ data, label = "Progreso", unit = "", color = "#0f172a", height = 160 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const sorted = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);

  if (sorted.length < 2) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
        Necesitas al menos 2 registros para ver la gráfica
      </div>
    );
  }

  const values = sorted.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const yMin = Math.max(0, min - pad);
  const yMax = max + pad;

  const width = 320;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 28;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const xFor = (i: number) => paddingLeft + (i / (sorted.length - 1)) * chartW;
  const yFor = (v: number) => paddingTop + ((yMax - v) / (yMax - yMin)) * chartH;

  const points = sorted.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(" ");

  const change = values[values.length - 1] - values[0];
  const changePct = values[0] ? (change / values[0]) * 100 : 0;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = yMin + (i / gridLines) * (yMax - yMin);
    return { y: yFor(v), value: v };
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</p>
          <p className="text-xs text-slate-500">{sorted.length} registros · {sorted[0].date} → {sorted[sorted.length - 1].date}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {change > 0 ? "+" : ""}{change.toFixed(1)}{unit} ({changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%)
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full h-auto select-none" onMouseLeave={() => setHoverIdx(null)}>
          {/* Grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={paddingLeft} y1={t.y} x2={width - paddingRight} y2={t.y} stroke="#e2e8f0" strokeWidth={i === 0 || i === gridLines ? 1 : 0.5} strokeDasharray={i % 2 === 0 ? "0" : "2 3"} />
              <text x={paddingLeft - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">
                {t.value.toFixed(t.value >= 100 ? 0 : 1)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <polygon
            fill={color}
            fillOpacity={0.08}
            points={`${points} ${xFor(sorted.length - 1)},${paddingTop + chartH} ${xFor(0)},${paddingTop + chartH}`}
          />

          {/* Line */}
          <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />

          {/* Points */}
          {sorted.map((d, i) => (
            <g key={i}>
              <circle
                cx={xFor(i)}
                cy={yFor(d.value)}
                r={hoverIdx === i ? 6 : 4}
                fill={color}
                stroke="white"
                strokeWidth="2"
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)}
              />
              {/* Invisible larger hitbox */}
              <circle cx={xFor(i)} cy={yFor(d.value)} r={14} fill="transparent" onMouseEnter={() => setHoverIdx(i)} className="cursor-pointer" />
            </g>
          ))}

          {/* Hover vertical line */}
          {hoverIdx !== null && (
            <line x1={xFor(hoverIdx)} y1={paddingTop} x2={xFor(hoverIdx)} y2={paddingTop + chartH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />
          )}

          {/* X labels */}
          {sorted.map((d, i) => {
            // Show ~5 labels to avoid crowding
            if (sorted.length <= 6 || i === 0 || i === sorted.length - 1 || i % Math.ceil(sorted.length / 4) === 0) {
              return (
                <text key={`x-${i}`} x={xFor(i)} y={height - 4} textAnchor="middle" fontSize="9" fill="#64748b">
                  {new Date(d.date + "T00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
                </text>
              );
            }
            return null;
          })}
        </svg>

        {hoverIdx !== null && (
          <div
            className="absolute bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none z-10 -translate-x-1/2"
            style={{ left: `${(hoverIdx / (sorted.length - 1)) * 100}%`, top: "4px" }}
          >
            <div className="font-bold">{sorted[hoverIdx].value}{unit}</div>
            <div className="text-[10px] text-slate-300">{sorted[hoverIdx].date}</div>
          </div>
        )}
      </div>
    </div>
  );
}
