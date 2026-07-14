"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, Plus, Minus, ChevronDown, Settings2 } from "lucide-react";

interface RestTimerProps {
  exerciseId: string;
  exerciseName: string;
  triggerTimestamp?: number;
  disabled?: boolean;
}

const PRESETS = [30, 60, 90, 120, 180];

export default function RestTimer({ exerciseId, exerciseName, triggerTimestamp, disabled }: RestTimerProps) {
  const storageKey = `emicoach-rest-${exerciseId}`;
  const [restSeconds, setRestSeconds] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load saved
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const v = Number(saved);
      if (!isNaN(v)) {
        setRestSeconds(v);
        setTimeLeft(v);
      }
    }
  }, [storageKey]);

  // Persist
  useEffect(() => {
    localStorage.setItem(storageKey, String(restSeconds));
  }, [restSeconds, storageKey]);

  // When restSeconds changes and not running, sync timeLeft
  useEffect(() => {
    if (!running && !finished) setTimeLeft(restSeconds);
  }, [restSeconds, running, finished]);

  // External trigger -> autostart
  useEffect(() => {
    if (!triggerTimestamp || disabled) return;
    setFinished(false);
    setTimeLeft(restSeconds);
    setRunning(true);
    // No auto-expand anymore, keep compact but visible
  }, [triggerTimestamp]); // eslint-disable-line

  const playBeep = useCallback(() => {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current as AudioContext;
      const mkBeep = (freq: number, at: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(freq, ctx.currentTime + at);
        g.gain.setValueAtTime(0.45, ctx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.5);
        o.start(ctx.currentTime + at);
        o.stop(ctx.currentTime + at + 0.5);
      };
      mkBeep(900, 0);
      mkBeep(1200, 0.25);
    } catch {}
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setRunning(false);
            setFinished(true);
            playBeep();
            // vibración si está disponible
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try { navigator.vibrate([200, 100, 200]); } catch {}
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, playBeep]);

  const start = () => { if (disabled) return; setFinished(false); setTimeLeft(restSeconds); setRunning(true); };
  const resume = () => { if (disabled) return; setFinished(false); setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setFinished(false); setTimeLeft(restSeconds); };

  const changeRest = (delta: number) => {
    const next = Math.max(10, Math.min(600, restSeconds + delta));
    setRestSeconds(next);
  };
  const selectPreset = (s: number) => { setRestSeconds(s); setRunning(false); setFinished(false); setTimeLeft(s); };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = restSeconds > 0 ? ((restSeconds - timeLeft) / restSeconds) * 100 : 0;

  return (
    <div className="border-b border-white/8 bg-white/4">
      {/* Compact header bar */}
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        {/* Left: label + editable rest */}
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${running ? "bg-cyan-400/18 text-cyan-100" : finished ? "bg-lime-300 text-slate-950" : "border border-white/10 bg-[#091120] text-slate-400"}`}>
            <Timer size={14} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Descanso</span>
          <span className="rounded-lg border border-white/10 bg-[#091120] px-2 py-0.5 text-xs font-mono font-semibold text-slate-200">
            {fmt(restSeconds)}
          </span>
        </div>

        {/* Center/Right: countdown display */}
        <div className="flex items-center gap-2">
          {/* Progress pill */}
          <div className="relative flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-black tabular-nums transition-all
              ${finished ? "bg-lime-300/14 border-lime-300/30 text-lime-100" : running ? "bg-cyan-400/16 border-cyan-400/28 text-white shadow-[0_0_24px_rgba(49,231,255,0.16)]" : "bg-[#091120] border-white/10 text-slate-500"}
            `}>
              {running || finished || timeLeft !== restSeconds ? (
                <>
                  <span>{finished ? "¡Listo!" : fmt(timeLeft)}</span>
                  {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />}
                </>
              ) : (
                <span className="text-slate-400 font-medium text-xs">--:--</span>
              )}
            </div>
            {/* mini progress bar under pill when running */}
            {running && (
              <div className="absolute -bottom-1.5 left-2 right-2 h-1 overflow-hidden rounded-full border border-white/10 bg-[#091120]">
                <div className="h-full bg-cyan-300 transition-all duration-1000" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {/* Control buttons */}
          {!disabled && (
            <>
              {running ? (
                <button onClick={pause} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#091120] text-slate-200 transition-colors hover:border-cyan-400/30">
                  <Pause size={14} />
                </button>
              ) : (
                <button onClick={timeLeft !== restSeconds && !finished ? resume : start} className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/16 text-cyan-100 transition-colors hover:bg-cyan-400/24">
                  <Play size={14} className="ml-0.5" />
                </button>
              )}
              {(running || finished || timeLeft !== restSeconds) && (
                <button onClick={reset} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#091120] text-slate-400 transition-colors hover:border-white/20 hover:text-white">
                  <RotateCcw size={14} />
                </button>
              )}
            </>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${expanded ? "bg-cyan-400/16 border-cyan-400/28 text-cyan-100" : "bg-[#091120] border-white/10 text-slate-400 hover:border-cyan-400/30 hover:text-white"}`}
            title="Editar tiempo de descanso"
          >
            <Settings2 size={14} className={expanded ? "rotate-90 transition-transform" : ""} />
          </button>
        </div>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-center gap-4 rounded-xl border border-white/10 bg-[#091120] p-3">
            <button onClick={() => changeRest(-15)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/4 text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-white">
              <Minus size={16} />
            </button>
            <div className="text-center">
              <div className="text-xl font-black font-mono text-white">{fmt(restSeconds)}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tiempo descanso</div>
            </div>
            <button onClick={() => changeRest(15)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/4 text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-white">
              <Plus size={16} />
            </button>
          </div>

          <div className="flex gap-1.5 justify-center flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => selectPreset(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${restSeconds === p ? "bg-cyan-400/16 text-white shadow-[0_0_18px_rgba(49,231,255,0.16)]" : "border border-white/10 bg-white/4 text-slate-300 hover:border-cyan-400/30"}`}
              >
                {fmt(p)}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-slate-500">
            Se activa automático al marcar una serie de <span className="font-semibold text-slate-300">{exerciseName}</span>. Se guarda por ejercicio.
          </p>
        </div>
      )}
    </div>
  );
}
