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
        isActive ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-900"
      }`}
      title={isActive ? "Pantalla siempre encendida activa" : "Activar pantalla siempre encendida"}
    >
      {isActive ? <Sun size={14} className="animate-pulse" /> : <Moon size={14} />}
      {isActive ? "Pantalla encendida" : "Mantener encendida"}
    </button>
  );
}
