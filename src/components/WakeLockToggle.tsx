"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Sun, Moon } from "lucide-react";

export default function WakeLockToggle({ autoEnable = true }: { autoEnable?: boolean }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported("wakeLock" in navigator);
  }, []);

  const requestLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        // @ts-ignore
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        setIsActive(true);
        wakeLockRef.current.addEventListener("release", () => {
          setIsActive(false);
        });
      }
    } catch (e) {
      console.warn("WakeLock error", e);
      setIsActive(false);
    }
  }, []);

  const releaseLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      setIsActive(false);
    } catch {}
  }, []);

  // Auto enable on mount if requested
  useEffect(() => {
    if (autoEnable && isSupported) {
      requestLock();
    }
    return () => { releaseLock(); };
  }, [autoEnable, isSupported, requestLock, releaseLock]);

  // Re-acquire when visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isActive) {
        requestLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isActive, requestLock]);

  if (!isSupported) return null;

  return (
    <button
      onClick={() => (isActive ? releaseLock() : requestLock())}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
        isActive ? "bg-amber-300/14 border-amber-300/28 text-amber-100" : "bg-[#091120] border-white/10 text-slate-400 hover:border-cyan-400/30 hover:text-white"
      }`}
      title={isActive ? "Pantalla siempre encendida activa" : "Activar pantalla siempre encendida"}
    >
      {isActive ? <Sun size={14} className="animate-pulse" /> : <Moon size={14} />}
      {isActive ? "Pantalla encendida" : "Mantener encendida"}
    </button>
  );
}
