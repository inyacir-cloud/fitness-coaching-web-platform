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
    <div className="border-b border-slate-100 bg-slate-50/70">
      {/* Compact header bar */}
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        {/* Left: label + editable rest */}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${running ? "bg-slate-900 text-white" : finished ? "bg-green-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
            <Timer size={14} />
          </div>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Descanso</span>
          <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 font-semibold">
            {fmt(restSeconds)}
          </span>
        </div>

        {/* Center/Right: countdown display */}
        <div className="flex items-center gap-2">
          {/* Progress pill */}
          <div className="relative flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-black tabular-nums transition-all
              ${finished ? "bg-green-50 border-green-200 text-green-700" : running ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400"}
            `}>
              {running || finished || timeLeft !== restSeconds ? (
                <>
                  <span>{finished ? "¡Listo!" : fmt(timeLeft)}</span>
                  {running && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                </>
              ) : (
                <span className="text-slate-400 font-medium text-xs">--:--</span>
              )}
            </div>
            {/* mini progress bar under pill when running */}
            {running && (
              <div className="absolute -bottom-1.5 left-2 right-2 h-1 bg-white rounded-full overflow-hidden border border-slate-100">
                <div className="h-full bg-slate-900 transition-all duration-1000" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {/* Control buttons */}
          {!disabled && (
            <>
              {running ? (
                <button onClick={pause} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:border-slate-900 transition-colors">
                  <Pause size={14} />
                </button>
              ) : (
                <button onClick={timeLeft !== restSeconds && !finished ? resume : start} className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors">
                  <Play size={14} className="ml-0.5" />
                </button>
              )}
              {(running || finished || timeLeft !== restSeconds) && (
                <button onClick={reset} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-colors">
                  <RotateCcw size={14} />
                </button>
              )}
            </>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${expanded ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-900 hover:text-slate-900"}`}
            title="Editar tiempo de descanso"
          >
            <Settings2 size={14} className={expanded ? "rotate-90 transition-transform" : ""} />
          </button>
        </div>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-center gap-4 bg-white rounded-xl border border-slate-200 p-3">
            <button onClick={() => changeRest(-15)} className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-900 flex items-center justify-center text-slate-700 transition-colors">
              <Minus size={16} />
            </button>
            <div className="text-center">
              <div className="text-xl font-black font-mono text-slate-900">{fmt(restSeconds)}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiempo descanso</div>
            </div>
            <button onClick={() => changeRest(15)} className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-900 flex items-center justify-center text-slate-700 transition-colors">
              <Plus size={16} />
            </button>
          </div>

          <div className="flex gap-1.5 justify-center flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => selectPreset(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${restSeconds === p ? "bg-slate-900 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-900"}`}
              >
                {fmt(p)}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-center text-slate-400">
            Se activa automático al marcar una serie de <span className="font-semibold text-slate-600">{exerciseName}</span>. Se guarda por ejercicio.
          </p>
        </div>
      )}
    </div>
  );
}
