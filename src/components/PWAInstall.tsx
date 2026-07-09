"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => {
        console.log("EmiCoach SW registered");
      }).catch(console.error);
    }

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show custom banner only if not already installed
      const dismissed = localStorage.getItem("emicoach-pwa-dismissed");
      if (!dismissed) setShowBanner(true);
    };

    const onInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("emicoach-pwa-dismissed", "1");
    setShowBanner(false);
  };

  if (!showBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 max-w-sm bg-slate-900 text-white rounded-2xl p-4 shadow-2xl z-50 flex gap-3 animate-in slide-in-from-bottom-2">
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 text-slate-900 font-black italic">E</div>
      <div className="flex-1">
        <p className="font-bold text-sm">Instalar EmiCoach</p>
        <p className="text-xs text-slate-300 mt-0.5">Instala la app para acceso rápido y modo offline</p>
        <div className="flex gap-2 mt-3">
          <button onClick={handleInstall} className="flex items-center gap-1.5 bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100">
            <Download size={14} /> Instalar
          </button>
          <button onClick={handleDismiss} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Ahora no</button>
        </div>
      </div>
      <button onClick={handleDismiss} className="p-1 text-slate-400 hover:text-white self-start">
        <X size={16} />
      </button>
    </div>
  );
}
