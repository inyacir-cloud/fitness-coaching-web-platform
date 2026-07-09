"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Trophy, ArrowLeft, RotateCcw, Plus, Trash2, TrendingDown, Activity, AlertTriangle, LogOut, History } from "lucide-react";
import type { Exercise, Meal, CompletedSet } from "@/db/schema";
import RestTimer from "@/components/RestTimer";
import WakeLockToggle from "@/components/WakeLockToggle";
import ProgressChart from "@/components/ProgressChart";

type BodyRow = {
  id: number;
  recordDate: string;
  weight: string | null;
  waist: string | null;
  hip: string | null;
  arm: string | null;
  thigh: string | null;
  chest: string | null;
  notes: string | null;
};
type InBodyRow = {
  id: number;
  recordDate: string;
  weight: string | null;
  bodyFatPercent: string | null;
  muscleMass: string | null;
  bmi: string | null;
  bodyWaterPercent: string | null;
  bmr: string | null;
  visceralFat: string | null;
  bodyAge: number | null;
  notes: string | null;
};

type Client = { id: number; name: string; username: string };
type TrainingDay = { id: number; clientId: number; dayName: string; exercises: Exercise[] };
type Diet = { id: number; clientId: number; meals: Meal[] } | null;
type ClientLog = {
  id: number;
  clientId: number;
  trainingDayId: number;
  logDate: string;
  completedSets: CompletedSet[];
  dayCompleted: boolean;
};

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(monday: Date) {
  const d = new Date(monday);
  d.setDate(monday.getDate() + 6);
  return d;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtShort(date: Date) {
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

type PaymentStatus = "activo" | "por_vencer" | "vencido";
type AuthState = "checking" | "login" | "blocked" | "deactivated" | "ok";

export default function ClientePage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [tab, setTab] = useState<"training" | "diet" | "progress">("training");
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [diet, setDiet] = useState<Diet>(null);
  const [weekLogs, setWeekLogs] = useState<ClientLog[]>([]);
  const [bodyData, setBodyData] = useState<BodyRow[]>([]);
  const [inbodyData, setInBodyData] = useState<InBodyRow[]>([]);
  const [selectedDayName, setSelectedDayName] = useState<string>("Lunes");
  const [viewingDayExercises, setViewingDayExercises] = useState(false);
  const [completedSets, setCompletedSets] = useState<CompletedSet[]>([]);
  const [dayCompleted, setDayCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timerTriggers, setTimerTriggers] = useState<Record<string, number>>({});
  const [showAddBody, setShowAddBody] = useState(false);
  const [showAddInBody, setShowAddInBody] = useState(false);
  const [prevWeights, setPrevWeights] = useState<Record<string, string>>({}); // key: `${exerciseId}-${idx}` -> weight
  const [historyLoading, setHistoryLoading] = useState(false);

  const monday = getMonday(new Date());
  const sunday = getSunday(monday);
  const mondayStr = toISODate(monday);
  const todayStr = toISODate(new Date());

  const loadClientData = useCallback(async (client: Client) => {
    setLoading(true);
    setSelectedClient(client);
    setSelectedDayName("Lunes");
    setViewingDayExercises(false);
    const [td, dietRes, wl, bd, ib] = await Promise.all([
      fetch(`/api/training-days?clientId=${client.id}`).then(r => r.json()),
      fetch(`/api/diet?clientId=${client.id}`).then(r => r.json()),
      fetch(`/api/client-logs/week?clientId=${client.id}&weekStart=${mondayStr}`).then(r => r.json()),
      fetch(`/api/body-progress?clientId=${client.id}`).then(r => r.json()),
      fetch(`/api/inbody?clientId=${client.id}`).then(r => r.json()),
    ]);
    setTrainingDays(td);
    setDiet(dietRes);
    setWeekLogs(wl);
    setBodyData(bd);
    setInBodyData(ib);
    setLoading(false);
  }, [mondayStr]);

  // Verifica la sesión guardada al cargar la página (aplica cancelación automática)
  const verifySession = useCallback(async (clientId: number) => {
    const res = await fetch(`/api/auth/verify?clientId=${clientId}`);
    if (!res.ok) {
      localStorage.removeItem("emicoach-client-session");
      setAuthState("login");
      return;
    }
    const data = await res.json();
    setPaymentStatus(data.status);
    setPaidUntil(data.paidUntil);
    if (data.isActive === false) {
      setAuthState("deactivated");
      setSelectedClient({ id: data.id, name: data.name, username: data.username });
    } else if (data.status === "vencido") {
      setAuthState("blocked");
      setSelectedClient({ id: data.id, name: data.name, username: data.username });
    } else {
      setAuthState("ok");
      await loadClientData({ id: data.id, name: data.name, username: data.username });
    }
  }, [loadClientData]);

  useEffect(() => {
    const saved = localStorage.getItem("emicoach-client-session");
    if (saved) {
      const { id } = JSON.parse(saved);
      verifySession(id);
    } else {
      setAuthState("login");
    }
  }, [verifySession]);

  const login = async () => {
    setLoginError("");
    if (!loginUsername || !loginPassword) {
      setLoginError("Ingresa usuario y contraseña");
      return;
    }
    setLoginLoading(true);
    const res = await fetch("/api/auth/client-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginUsername, password: loginPassword }),
    });
    setLoginLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setLoginError(data.error ?? "Error al iniciar sesión");
      return;
    }
    const data = await res.json();
    localStorage.setItem("emicoach-client-session", JSON.stringify({ id: data.id }));
    setPaymentStatus(data.status);
    setPaidUntil(data.paidUntil);
    if (data.isActive === false) {
      setAuthState("deactivated");
      setSelectedClient({ id: data.id, name: data.name, username: data.username });
    } else if (data.status === "vencido") {
      setAuthState("blocked");
      setSelectedClient({ id: data.id, name: data.name, username: data.username });
    } else {
      setAuthState("ok");
      await loadClientData({ id: data.id, name: data.name, username: data.username });
    }
  };

  const logout = () => {
    localStorage.removeItem("emicoach-client-session");
    setSelectedClient(null);
    setAuthState("login");
    setLoginUsername("");
    setLoginPassword("");
  };

  const getTrainingDayByName = useCallback((name: string) => trainingDays.find(d => d.dayName === name), [trainingDays]);

  const currentTrainingDay = getTrainingDayByName(selectedDayName);

  const findWeekLogForTrainingDay = useCallback((trainingDayId: number | undefined) => {
    if (!trainingDayId) return null;
    const logs = weekLogs
      .filter(l => l.trainingDayId === trainingDayId)
      .sort((a, b) => b.logDate.localeCompare(a.logDate));
    return logs[0] ?? null;
  }, [weekLogs]);

  const fetchHistoryWeights = useCallback(async (trainingDay: TrainingDay) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/client-logs/history?clientId=${selectedClient!.id}&trainingDayId=${trainingDay.id}`);
      const history: ClientLog[] = await res.json();
      // Build map of last weights per exerciseId-setIndex
      const map: Record<string, string> = {};
      // Traverse from newest to oldest? We want most recent where weight present
      // History already sorted desc by date (newest first)
      for (const log of history) {
        if (log.logDate === todayStr) continue; // skip today
        for (const cs of log.completedSets) {
          if (!cs.weight) continue;
          const key = `${cs.exerciseId}-${cs.setIndex}`;
          if (!map[key]) map[key] = cs.weight;
        }
      }
      setPrevWeights(map);
      return map;
    } catch {
      setPrevWeights({});
      return {};
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedClient, todayStr]);

  const refreshLogFromWeek = useCallback((trainingDay: TrainingDay | undefined, historyMap?: Record<string, string>) => {
    if (!trainingDay) {
      setCompletedSets([]);
      setDayCompleted(false);
      return;
    }
    const log = findWeekLogForTrainingDay(trainingDay.id);
    if (log) {
      setCompletedSets(log.completedSets);
      setDayCompleted(log.dayCompleted);
    } else {
      const init: CompletedSet[] = trainingDay.exercises.flatMap(ex =>
        ex.sets.map((_, i) => {
          const key = `${ex.id}-${i}`;
          const prev = historyMap?.[key] ?? "";
          return { exerciseId: ex.id, setIndex: i, weight: prev, done: false };
        })
      );
      setCompletedSets(init);
      setDayCompleted(false);
    }
  }, [findWeekLogForTrainingDay]);

  const enterDayDetail = async (dayName: string) => {
    setSelectedDayName(dayName);
    const td = getTrainingDayByName(dayName);
    if (!td) return;
    // Load history first to autocomplete
    const historyMap = await fetchHistoryWeights(td);
    refreshLogFromWeek(td, historyMap);
    setViewingDayExercises(true);
  };

  const backToDays = () => {
    setViewingDayExercises(false);
  };

  const isDayCompletedThisWeek = (trainingDayId: number | undefined) => {
    if (!trainingDayId) return false;
    return weekLogs.some(l => l.trainingDayId === trainingDayId && l.dayCompleted);
  };

  const toggleSet = (exerciseId: string, setIndex: number) => {
    if (dayCompleted) return;
    setCompletedSets(prev =>
      prev.map(s => {
        if (s.exerciseId === exerciseId && s.setIndex === setIndex) {
          const nextDone = !s.done;
          if (nextDone) setTimerTriggers(t => ({ ...t, [exerciseId]: Date.now() }));
          return { ...s, done: nextDone };
        }
        return s;
      })
    );
  };

  const updateWeight = (exerciseId: string, setIndex: number, weight: string) => {
    if (dayCompleted) return;
    setCompletedSets(prev => prev.map(s => s.exerciseId === exerciseId && s.setIndex === setIndex ? { ...s, weight } : s));
  };

  const getSet = (exerciseId: string, setIndex: number) => completedSets.find(s => s.exerciseId === exerciseId && s.setIndex === setIndex);

  // Auto-guardado: guarda progreso automáticamente cuando cambian las series (sin marcar día completo)
  useEffect(() => {
    if (!viewingDayExercises || !currentTrainingDay || dayCompleted || completedSets.length === 0) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch("/api/client-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedClient!.id,
            trainingDayId: currentTrainingDay.id,
            logDate: todayStr,
            completedSets,
            dayCompleted: false,
          }),
        });
        if (res.ok) {
          const saved: ClientLog = await res.json();
          setWeekLogs(prev => {
            const others = prev.filter(l => !(l.trainingDayId === saved.trainingDayId && l.logDate === saved.logDate));
            return [...others, saved];
          });
        }
      } catch {}
    }, 900);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSets]);

  const saveLog = async (completed: boolean) => {
    if (!currentTrainingDay) return;
    setSaving(true);
    const res = await fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient!.id,
        trainingDayId: currentTrainingDay.id,
        logDate: todayStr,
        completedSets,
        dayCompleted: completed,
      }),
    });
    const saved: ClientLog = await res.json();
    setWeekLogs(prev => {
      const others = prev.filter(l => !(l.trainingDayId === saved.trainingDayId && l.logDate === saved.logDate));
      return [...others, saved];
    });
    setDayCompleted(completed);
    setSaving(false);
  };

  const uncompleteDay = async () => {
    if (!currentTrainingDay) return;
    setSaving(true);
    const resetSets = completedSets.map(s => ({ ...s, done: false }));
    setCompletedSets(resetSets);
    const res = await fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient!.id,
        trainingDayId: currentTrainingDay.id,
        logDate: todayStr,
        completedSets: resetSets,
        dayCompleted: false,
      }),
    });
    const saved: ClientLog = await res.json();
    setWeekLogs(prev => {
      const others = prev.filter(l => !(l.trainingDayId === saved.trainingDayId && l.logDate === saved.logDate));
      return [...others, saved];
    });
    setDayCompleted(false);
    setSaving(false);
  };

  const totalSets = completedSets.length;
  const doneSets = completedSets.filter(s => s.done).length;
  const progress = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  // --- Body progress helpers ---
  const saveBody = async (data: Partial<BodyRow> & { recordDate: string }) => {
    await fetch("/api/body-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClient!.id, ...data }),
    });
    setShowAddBody(false);
    const res = await fetch(`/api/body-progress?clientId=${selectedClient!.id}`);
    setBodyData(await res.json());
  };
  const deleteBody = async (id: number) => {
    await fetch(`/api/body-progress?id=${id}`, { method: "DELETE" });
    const res = await fetch(`/api/body-progress?clientId=${selectedClient!.id}`);
    setBodyData(await res.json());
  };
  const saveInBody = async (data: Partial<InBodyRow> & { recordDate: string }) => {
    await fetch("/api/inbody", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClient!.id, ...data }),
    });
    setShowAddInBody(false);
    const res = await fetch(`/api/inbody?clientId=${selectedClient!.id}`);
    setInBodyData(await res.json());
  };
  const deleteInBody = async (id: number) => {
    await fetch(`/api/inbody?id=${id}`, { method: "DELETE" });
    const res = await fetch(`/api/inbody?clientId=${selectedClient!.id}`);
    setInBodyData(await res.json());
  };

  const daysWithRoutine = DAYS.filter(d => {
    const td = getTrainingDayByName(d);
    return td && td.exercises.length > 0;
  });
  const completedThisWeek = daysWithRoutine.filter(d => {
    const td = getTrainingDayByName(d);
    return td && isDayCompletedThisWeek(td.id);
  }).length;

  if (authState === "checking" || loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-slate-400" size={40} />
    </div>
  );

  if (authState === "login") return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black italic text-slate-900 tracking-tighter">EMICOACH</h1>
          <p className="text-slate-500 text-sm mt-2">Ingresa con tu usuario y contraseña</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-semibold">Usuario</label>
            <input
              type="text"
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="tu.usuario"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300 mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold">Contraseña</label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="••••••••"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300 mt-1"
            />
          </div>
          {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
          <button
            onClick={login}
            disabled={loginLoading}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loginLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Iniciar sesión
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">Solicita tus datos de acceso a tu coach</p>
      </div>
    </main>
  );

  if (authState === "blocked") return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-500" size={32} />
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Acceso Suspendido</h1>
        <p className="text-slate-500 text-sm mb-1">Hola {selectedClient?.name?.split(" ")[0]}, tu pago está vencido.</p>
        {paidUntil && <p className="text-slate-400 text-xs mb-4">Tu periodo venció el {new Date(paidUntil + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>}
        <p className="text-slate-600 text-sm mb-6">Por favor contacta a tu coach para reactivar tu cuenta y volver a ver tu rutina, dieta y progreso.</p>
        <button onClick={logout} className="w-full border border-slate-200 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          Cerrar sesión
        </button>
      </div>
    </main>
  );

  if (authState === "deactivated") return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-slate-500" size={32} />
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Cuenta Desactivada</h1>
        <p className="text-slate-500 text-sm mb-1">Hola {selectedClient?.name?.split(" ")[0]}, tu acceso fue desactivado por tu coach.</p>
        <p className="text-slate-600 text-sm mb-6">Contacta a tu coach para más información y reactivar tu cuenta.</p>
        <button onClick={logout} className="w-full border border-slate-200 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          Cerrar sesión
        </button>
      </div>
    </main>
  );

  if (!selectedClient) return null;

  return (
    <main className={`min-h-screen bg-slate-50 ${viewingDayExercises ? "" : "pb-24"}`}>
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={logout} className="p-2 hover:bg-slate-100 rounded-lg" title="Cerrar sesión">
            <LogOut size={18} className="text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 leading-tight">{selectedClient.name}</h2>
            <p className="text-[11px] text-slate-400 italic">Semana {fmtShort(monday)} – {fmtShort(sunday)} · EMICOACH</p>
          </div>
          {!viewingDayExercises && (
            <div className="text-right">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progreso</p>
              <p className="text-sm font-black text-slate-900">{completedThisWeek}/{daysWithRoutine.length}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Tab switch */}
        <div className="flex bg-slate-100 rounded-2xl p-1 mb-5 w-fit mx-auto">
          <button onClick={() => { setTab("training"); setViewingDayExercises(false); }} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "training" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Entrenamiento</button>
          <button onClick={() => { setTab("diet"); setViewingDayExercises(false); }} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "diet" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Dieta</button>
          <button onClick={() => { setTab("progress"); setViewingDayExercises(false); }} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "progress" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Progreso</button>
        </div>

        {/* ==================== TRAINING TAB ==================== */}
        {tab === "training" && !viewingDayExercises && (
          <>
            {/* Day selector */}
            <div className="mb-5">
              <h3 className="font-bold text-slate-800 text-lg mb-3">Elige un día</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {DAYS.map(day => {
                  const td = getTrainingDayByName(day);
                  const hasContent = td && td.exercises.length > 0;
                  const completed = td ? isDayCompletedThisWeek(td.id) : false;

                  let style = "bg-white border-slate-200 text-slate-500 hover:border-slate-400";
                  if (!hasContent) {
                    style = "bg-slate-50 border-dashed border-slate-200 text-slate-300 cursor-not-allowed opacity-70";
                  } else if (completed) {
                    style = "bg-green-50 border-green-300 text-green-700 hover:border-green-500 hover:bg-green-100";
                  } else {
                    style = "bg-white border-slate-200 text-slate-700 hover:border-slate-900 hover:bg-slate-50";
                  }

                  return (
                    <button
                      key={day}
                      disabled={!hasContent}
                      onClick={() => hasContent && enterDayDetail(day)}
                      className={`shrink-0 px-5 py-3 rounded-xl text-sm font-bold transition-all border flex flex-col items-center min-w-[72px] ${style}`}
                    >
                      <span className="text-base">{day.slice(0, 3)}</span>
                      <span className="text-[10px] font-normal mt-0.5 tracking-wide">
                        {completed ? "✓ hecho" : hasContent ? `${td!.exercises.length} ej.` : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week progress bar */}
            {daysWithRoutine.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Progreso semanal</span>
                  <span className={completedThisWeek === daysWithRoutine.length ? "text-green-600" : "text-slate-700"}>{completedThisWeek}/{daysWithRoutine.length} días</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full transition-all duration-700" style={{ width: `${daysWithRoutine.length ? (completedThisWeek / daysWithRoutine.length) * 100 : 0}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Se reinicia cada lunes. Los días completados aparecen en verde.</p>
              </div>
            )}
          </>
        )}

        {tab === "training" && viewingDayExercises && (
          <>
            {/* Day detail top bar with progress + back button + wake lock */}
            <div className="sticky top-[57px] z-10 -mx-4 px-4 md:-mx-6 md:px-6 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={backToDays}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-900 px-3 py-1.5 rounded-xl transition-all"
                >
                  <ArrowLeft size={14} />
                  Volver
                </button>
                <div className="flex items-center gap-2">
                  <WakeLockToggle autoEnable={true} />
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">{selectedDayName}</p>
                    {totalSets > 0 && (
                      <p className="text-[10px] text-slate-400">{doneSets}/{totalSets} series</p>
                    )}
                  </div>
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${dayCompleted ? "bg-green-600" : "bg-slate-900"}`} style={{ width: `${totalSets ? (dayCompleted ? 100 : progress) : 0}%` }} />
                  </div>
                </div>
              </div>
              {historyLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Loader2 size={12} className="animate-spin" /> Cargando pesos anteriores...
                </div>
              )}
            </div>

            {currentTrainingDay && currentTrainingDay.exercises.length > 0 && (
              <div className="space-y-4">
                {dayCompleted && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Trophy className="text-green-600 shrink-0" size={24} />
                      <div>
                        <p className="font-bold text-green-800">¡Día completado! 🎉</p>
                        <p className="text-xs text-green-600">Se reiniciará el lunes. Puedes desmarcar para volver a entrenar.</p>
                      </div>
                    </div>
                    <button onClick={uncompleteDay} disabled={saving} className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-white border border-green-200 hover:border-green-700 px-3 py-2 rounded-xl transition-colors">
                      <RotateCcw size={14} /> Desmarcar
                    </button>
                  </div>
                )}

                {currentTrainingDay.exercises.map((ex, exIdx) => (
                  <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100">
                      <span className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">{exIdx + 1}</span>
                      <span className="font-bold text-slate-900">{ex.name}</span>
                    </div>
                    <RestTimer exerciseId={ex.id} exerciseName={ex.name || `Ejercicio ${exIdx + 1}`} triggerTimestamp={timerTriggers[ex.id]} disabled={dayCompleted} />
                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                        <span className="col-span-1">S.</span>
                        <span className="col-span-4">Reps</span>
                        <span className="col-span-5">Mi peso</span>
                        <span className="col-span-2 text-center">✓</span>
                      </div>
                      {ex.sets.map((s, sIdx) => {
                        const cs = getSet(ex.id, sIdx);
                        const prevKey = `${ex.id}-${sIdx}`;
                        const prevWeight = prevWeights[prevKey];
                        const showPrev = prevWeight && (!cs?.weight || cs.weight === prevWeight);
                        return (
                          <div key={sIdx} className={`grid grid-cols-12 gap-2 items-start rounded-xl p-2 transition-colors ${cs?.done ? "bg-green-50" : ""}`}>
                            <span className="col-span-1 text-sm font-mono text-slate-400 pt-2">#{sIdx + 1}</span>
                            <span className="col-span-4 text-sm text-slate-700 font-medium pt-2">{s.reps}</span>
                            <div className="col-span-5 space-y-1">
                              <input type="text" placeholder={prevWeight ? `Últ: ${prevWeight}` : "kg"} value={cs?.weight ?? ""} onChange={e => updateWeight(ex.id, sIdx, e.target.value)} disabled={dayCompleted} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50" />
                              {showPrev && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <History size={10} /> Anterior: <span className="font-bold">{prevWeight}</span>
                                </div>
                              )}
                            </div>
                            <button onClick={() => toggleSet(ex.id, sIdx)} disabled={dayCompleted} className={`col-span-2 w-8 h-8 mx-auto mt-1 rounded-xl border-2 flex items-center justify-center transition-all ${cs?.done ? "bg-green-600 border-green-600 text-white" : "border-slate-300 text-transparent hover:border-slate-500"}`}>
                              <Check size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== DIET TAB ==================== */}
        {tab === "diet" && (
          <>
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 text-lg">Tu Plan de Alimentación</h3>
              <p className="text-xs text-slate-500">Dieta general · Aplica todos los días</p>
            </div>

            {!diet || diet.meals.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <p className="text-4xl mb-3">🥗</p>
                <p className="font-semibold text-slate-800">Sin dieta asignada</p>
                <p className="text-sm text-slate-400 mt-1">Tu coach aún no ha asignado un plan de alimentación.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diet.meals.map((meal, idx) => (
                  <div key={meal.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100">
                      <span className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                      <span className="font-bold text-slate-900">{meal.time}</span>
                    </div>
                    <div className="p-5">
                      <p className="text-slate-700 leading-relaxed">{meal.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== PROGRESS TAB ==================== */}
        {tab === "progress" && (
          <div className="space-y-5">
            {/* Body progress */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingDown size={18} className="text-slate-700" />
                  <div>
                    <h3 className="font-bold text-slate-900">Peso y medidas</h3>
                    <p className="text-xs text-slate-500">Registra tu progreso corporal</p>
                  </div>
                </div>
                <button onClick={() => setShowAddBody(true)} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800">
                  <Plus size={14} /> Nuevo
                </button>
              </div>

              {bodyData.length > 0 && (
                <div className="mb-5">
                  <ProgressChart
                    data={bodyData
                      .filter(b => b.weight)
                      .map(b => ({ date: b.recordDate, value: Number(b.weight) }))
                      .reverse()}
                    label="Evolución de Peso"
                    unit="kg"
                    color="#0f172a"
                  />
                </div>
              )}

              {bodyData.length > 0 && bodyData.some(b => b.waist) && (
                <div className="mb-5">
                  <ProgressChart
                    data={bodyData
                      .filter(b => b.waist)
                      .map(b => ({ date: b.recordDate, value: Number(b.waist) }))
                      .reverse()}
                    label="Evolución Cintura"
                    unit="cm"
                    color="#16a34a"
                  />
                </div>
              )}

              {bodyData.length === 0 && !showAddBody && (
                <p className="text-center text-slate-400 py-8 text-sm">Sin registros aún. Agrega tu primer registro de peso y medidas.</p>
              )}

              {bodyData.length > 0 && (
                <div className="space-y-2">
                  {bodyData.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                      <div>
                        <p className="font-bold text-slate-900">{new Date(b.recordDate + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {b.weight && <span className="font-semibold">{b.weight} kg</span>}
                          {b.waist && <span> · Cintura {b.waist}cm</span>}
                          {b.hip && <span> · Cadera {b.hip}cm</span>}
                          {b.arm && <span> · Brazo {b.arm}cm</span>}
                          {b.thigh && <span> · Muslo {b.thigh}cm</span>}
                        </p>
                      </div>
                      <button onClick={() => deleteBody(b.id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddBody && <BodyForm onSave={saveBody} onCancel={() => setShowAddBody(false)} />}
            </section>

            {/* InBody */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-slate-700" />
                  <div>
                    <h3 className="font-bold text-slate-900">InBody / Composición corporal</h3>
                    <p className="text-xs text-slate-500">Registra tu InBody mensual</p>
                  </div>
                </div>
                <button onClick={() => setShowAddInBody(true)} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800">
                  <Plus size={14} /> Nuevo
                </button>
              </div>

              {inbodyData.length > 0 && (
                <>
                  <div className="mb-5">
                    <ProgressChart
                      data={inbodyData.filter(i => i.bodyFatPercent).map(i => ({ date: i.recordDate, value: Number(i.bodyFatPercent) })).reverse()}
                      label="Grasa Corporal"
                      unit="%"
                      color="#ef4444"
                    />
                  </div>
                  <div className="mb-5">
                    <ProgressChart
                      data={inbodyData.filter(i => i.muscleMass).map(i => ({ date: i.recordDate, value: Number(i.muscleMass) })).reverse()}
                      label="Masa Muscular"
                      unit="kg"
                      color="#16a34a"
                    />
                  </div>
                </>
              )}

              {inbodyData.length === 0 && !showAddInBody && (
                <p className="text-center text-slate-400 py-8 text-sm">Sin registros aún. Agrega tu primer InBody.</p>
              )}

              {inbodyData.length > 0 && (
                <div className="space-y-3">
                  {inbodyData.map(ib => (
                    <InBodyCardClient key={ib.id} record={ib} onDelete={() => deleteInBody(ib.id)} />
                  ))}
                </div>
              )}

              {showAddInBody && <InBodyForm onSave={saveInBody} onCancel={() => setShowAddInBody(false)} />}
            </section>
          </div>
        )}
      </div>

      {/* Bottom action: only appears when all series are marked and day not completed */}
      {tab === "training" && viewingDayExercises && currentTrainingDay && currentTrainingDay.exercises.length > 0 && !dayCompleted && progress === 100 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 p-4 safe-bottom">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => saveLog(true)}
              disabled={saving}
              className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-200 transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
              Marcar día completo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ============ CLIENT BODY FORM ============
function BodyForm({ onSave, onCancel }: {
  onSave: (data: Partial<BodyRow> & { recordDate: string }) => void;
  onCancel: () => void;
}) {
  const [recordDate, setRecordDate] = useState(toISODate(new Date()));
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [arm, setArm] = useState("");
  const [thigh, setThigh] = useState("");
  const [chest, setChest] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nuevo registro</p>
      <div>
        <label className="text-xs text-slate-500">Fecha</label>
        <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-slate-500">Peso (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="72.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Cintura (cm)</label><input type="number" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} placeholder="80" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Cadera (cm)</label><input type="number" step="0.1" value={hip} onChange={e => setHip(e.target.value)} placeholder="95" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Brazo (cm)</label><input type="number" step="0.1" value={arm} onChange={e => setArm(e.target.value)} placeholder="32" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Muslo (cm)</label><input type="number" step="0.1" value={thigh} onChange={e => setThigh(e.target.value)} placeholder="55" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Pecho (cm)</label><input type="number" step="0.1" value={chest} onChange={e => setChest(e.target.value)} placeholder="95" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
      </div>
      <div><label className="text-xs text-slate-500">Notas (opcional)</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave({ recordDate, weight, waist, hip, arm, thigh, chest, notes })} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800">Guardar</button>
        <button onClick={onCancel} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-white">Cancelar</button>
      </div>
    </div>
  );
}

// ============ CLIENT INBODY FORM ============
function InBodyForm({ onSave, onCancel }: {
  onSave: (data: Partial<InBodyRow> & { recordDate: string }) => void;
  onCancel: () => void;
}) {
  const [recordDate, setRecordDate] = useState(toISODate(new Date()));
  const [weight, setWeight] = useState("");
  const [bodyFatPercent, setBodyFat] = useState("");
  const [muscleMass, setMuscle] = useState("");
  const [bmi, setBmi] = useState("");
  const [bodyWaterPercent, setWater] = useState("");
  const [bmr, setBmr] = useState("");
  const [visceralFat, setVisceral] = useState("");
  const [bodyAge, setBodyAge] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nuevo InBody</p>
      <div>
        <label className="text-xs text-slate-500">Fecha</label>
        <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-slate-500">Peso (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="72.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Grasa corporal (%)</label><input type="number" step="0.1" value={bodyFatPercent} onChange={e => setBodyFat(e.target.value)} placeholder="18.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Masa muscular (kg)</label><input type="number" step="0.1" value={muscleMass} onChange={e => setMuscle(e.target.value)} placeholder="32" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">IMC</label><input type="number" step="0.1" value={bmi} onChange={e => setBmi(e.target.value)} placeholder="22.5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Agua corporal (%)</label><input type="number" step="0.1" value={bodyWaterPercent} onChange={e => setWater(e.target.value)} placeholder="60" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Tasa metabólica (kcal)</label><input type="number" value={bmr} onChange={e => setBmr(e.target.value)} placeholder="1700" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Grasa visceral</label><input type="number" step="1" value={visceralFat} onChange={e => setVisceral(e.target.value)} placeholder="5" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><label className="text-xs text-slate-500">Edad corporal</label><input type="number" step="1" value={bodyAge} onChange={e => setBodyAge(e.target.value)} placeholder="25" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
      </div>
      <div><label className="text-xs text-slate-500">Notas (opcional)</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: buen progreso de fuerza" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave({
          recordDate,
          weight,
          bodyFatPercent,
          muscleMass,
          bmi,
          bodyWaterPercent,
          bmr,
          visceralFat,
          bodyAge: bodyAge ? Number(bodyAge) : null,
          notes,
        })} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800">Guardar</button>
        <button onClick={onCancel} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-white">Cancelar</button>
      </div>
    </div>
  );
}

// ============ INBODY CARD CLIENT ============
import { ChevronDown } from "lucide-react";

function InBodyCardClient({ record, onDelete }: { record: InBodyRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const metrics = [
    { label: "Peso", value: record.weight, unit: "kg" },
    { label: "Grasa corporal", value: record.bodyFatPercent, unit: "%" },
    { label: "Masa muscular", value: record.muscleMass, unit: "kg" },
    { label: "IMC", value: record.bmi, unit: "" },
    { label: "Agua corporal", value: record.bodyWaterPercent, unit: "%" },
    { label: "Tasa metabólica", value: record.bmr, unit: "kcal" },
    { label: "Grasa visceral", value: record.visceralFat, unit: "" },
    { label: "Edad corporal", value: record.bodyAge != null ? String(record.bodyAge) : null, unit: "años" },
  ].filter(m => m.value !== null && m.value !== "");

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">
            {new Date(record.recordDate + "T00:00").toLocaleDateString("es-MX", { month: "short" }).toUpperCase().slice(0, 3)}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">
              {new Date(record.recordDate + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-xs text-slate-500">
              {record.weight && <span>{record.weight} kg</span>}
              {record.bodyFatPercent && <span> · {record.bodyFatPercent}% grasa</span>}
              {record.muscleMass && <span> · {record.muscleMass}kg músculo</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div onClick={e => { e.stopPropagation(); onDelete(); }} className="text-slate-300 hover:text-red-500 p-1 cursor-pointer transition-colors">
            <Trash2 size={14} />
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map(m => (
              <div key={m.label} className="bg-white rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{m.label}</p>
                <p className="text-lg font-black text-slate-900">{m.value}<span className="text-xs text-slate-400 ml-1">{m.unit}</span></p>
              </div>
            ))}
          </div>
          {record.notes && (
            <p className="mt-3 text-sm text-slate-600 italic">"{record.notes}"</p>
          )}
        </div>
      )}
    </div>
  );
}
