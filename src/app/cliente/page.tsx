"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Loader2, Trophy, ArrowLeft, RotateCcw, Plus, Trash2, TrendingDown, Activity, AlertTriangle, LogOut, History } from "lucide-react";
import type { Exercise, Meal, CompletedSet, WeightUnit } from "@/db/schema";
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
type TrainingDay = { id: number; clientId: number; dayName: string; displayName?: string; exercises: Exercise[] };
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
type ExerciseSessionSize = number;
type ExerciseGroup = { key: string; exercises: Exercise[]; size: ExerciseSessionSize };
type PreviousWeight = { weight: string; unit: WeightUnit };

const DEFAULT_WEIGHT_UNIT: WeightUnit = "kg";

function getExerciseSessionKey(exercise: Exercise) {
  return exercise.sessionId ?? exercise.id;
}

function groupExercisesBySession(exercises: Exercise[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  const order: string[] = [];

  for (const exercise of exercises) {
    const key = getExerciseSessionKey(exercise);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        exercises: [],
        size: exercise.sessionSize ?? 1,
      });
      order.push(key);
    }

    const group = groups.get(key)!;
    group.exercises.push(exercise);
    group.size = Math.max(group.exercises.length, exercise.sessionSize ?? 1) as ExerciseSessionSize;
  }

  return order.map((key) => {
    const group = groups.get(key)!;
    return {
      ...group,
      size: Math.max(1, group.exercises.length) as ExerciseSessionSize,
    };
  });
}

function getSessionLabel(size: ExerciseSessionSize) {
  if (size === 2) return "Biserie";
  if (size === 3) return "Triserie";
  if (size >= 4) return "Superserie";
  return "Ejercicio";
}

function normalizeWeightUnit(unit?: string | null): WeightUnit {
  return unit === "lb" ? "lb" : DEFAULT_WEIGHT_UNIT;
}

function formatWeightWithUnit(weight: string, unit?: WeightUnit) {
  const trimmed = weight.trim();
  if (!trimmed) return "";
  return `${trimmed} ${normalizeWeightUnit(unit)}`;
}

function buildTrainingSignature(days: TrainingDay[]) {
  return JSON.stringify(
    [...days]
      .map((day) => ({
        dayName: day.dayName,
        displayName: day.displayName ?? "",
        exercises: day.exercises,
      }))
      .sort((a, b) => a.dayName.localeCompare(b.dayName))
  );
}

function buildDietSignature(currentDiet: Diet) {
  if (!currentDiet) return "";
  return JSON.stringify(currentDiet.meals ?? []);
}

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
  const [prevWeights, setPrevWeights] = useState<Record<string, PreviousWeight>>({}); // key: `${exerciseId}-${idx}` -> weight + unit
  const [historyLoading, setHistoryLoading] = useState(false);
  const [livePlanNotice, setLivePlanNotice] = useState<string | null>(null);
  const [dayCompletionNotice, setDayCompletionNotice] = useState<string | null>(null);
  const [showCongratsGif, setShowCongratsGif] = useState(false);
  const planSignatureRef = useRef<{ training: string; diet: string }>({ training: "", diet: "" });
  const liveNoticeTimeoutRef = useRef<number | null>(null);
  const dayCompletionTimeoutRef = useRef<number | null>(null);
  const congratsGifTimeoutRef = useRef<number | null>(null);

  const monday = getMonday(new Date());
  const sunday = getSunday(monday);
  const mondayStr = toISODate(monday);
  const todayStr = toISODate(new Date());

  const showLivePlanNotice = useCallback((message: string) => {
    setLivePlanNotice(message);
    if (liveNoticeTimeoutRef.current !== null) {
      window.clearTimeout(liveNoticeTimeoutRef.current);
    }
    liveNoticeTimeoutRef.current = window.setTimeout(() => {
      setLivePlanNotice(null);
      liveNoticeTimeoutRef.current = null;
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (liveNoticeTimeoutRef.current !== null) {
        window.clearTimeout(liveNoticeTimeoutRef.current);
      }
      if (dayCompletionTimeoutRef.current !== null) {
        window.clearTimeout(dayCompletionTimeoutRef.current);
      }
      if (congratsGifTimeoutRef.current !== null) {
        window.clearTimeout(congratsGifTimeoutRef.current);
      }
    };
  }, []);

  const loadClientData = useCallback(async (client: Client) => {
    setLoading(true);
    setSelectedClient(client);
    setSelectedDayName("Lunes");
    setViewingDayExercises(false);
    const ts = Date.now();
    const [td, dietRes, wl, bd, ib] = await Promise.all([
      fetch(`/api/training-days?clientId=${client.id}&ts=${ts}`, { cache: "no-store" }).then(r => r.json()),
      fetch(`/api/diet?clientId=${client.id}&ts=${ts}`, { cache: "no-store" }).then(r => r.json()),
      fetch(`/api/client-logs/week?clientId=${client.id}&weekStart=${mondayStr}`).then(r => r.json()),
      fetch(`/api/body-progress?clientId=${client.id}`).then(r => r.json()),
      fetch(`/api/inbody?clientId=${client.id}`).then(r => r.json()),
    ]);
    setTrainingDays(td);
    setDiet(dietRes);
    setWeekLogs(wl);
    setBodyData(bd);
    setInBodyData(ib);
    planSignatureRef.current = {
      training: buildTrainingSignature(td),
      diet: buildDietSignature(dietRes),
    };
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
  const groupedExercises = currentTrainingDay ? groupExercisesBySession(currentTrainingDay.exercises) : [];

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
      const map: Record<string, PreviousWeight> = {};
      for (const log of history) {
        if (log.logDate === todayStr) continue; // skip today
        for (const cs of log.completedSets) {
          if (!cs.weight) continue;
          const key = `${cs.exerciseId}-${cs.setIndex}`;
          if (!map[key]) {
            map[key] = {
              weight: cs.weight,
              unit: normalizeWeightUnit(cs.weightUnit),
            };
          }
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

  const refreshLogFromWeek = useCallback((trainingDay: TrainingDay | undefined, historyMap?: Record<string, PreviousWeight>) => {
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
          const prev = historyMap?.[key];
          return {
            exerciseId: ex.id,
            setIndex: i,
            weight: prev?.weight ?? "",
            weightUnit: prev?.unit ?? DEFAULT_WEIGHT_UNIT,
            done: false,
          };
        })
      );
      setCompletedSets(init);
      setDayCompleted(false);
    }
  }, [findWeekLogForTrainingDay]);

  // Sincronización en vivo: cuando coach guarda cambios, el cliente los recibe sin recargar.
  useEffect(() => {
    if (authState !== "ok" || !selectedClient) return;

    let cancelled = false;

    const syncPlan = async () => {
      try {
        const ts = Date.now();
        const [tdRes, dietRes] = await Promise.all([
          fetch(`/api/training-days?clientId=${selectedClient.id}&ts=${ts}`, { cache: "no-store" }),
          fetch(`/api/diet?clientId=${selectedClient.id}&ts=${ts}`, { cache: "no-store" }),
        ]);
        if (!tdRes.ok || !dietRes.ok || cancelled) return;

        const [nextTrainingDays, nextDiet] = await Promise.all([tdRes.json(), dietRes.json()]);
        if (cancelled) return;

        const nextTrainingSignature = buildTrainingSignature(nextTrainingDays);
        const nextDietSignature = buildDietSignature(nextDiet);
        const hasTrainingChanges = nextTrainingSignature !== planSignatureRef.current.training;
        const hasDietChanges = nextDietSignature !== planSignatureRef.current.diet;
        if (!hasTrainingChanges && !hasDietChanges) return;

        planSignatureRef.current = {
          training: nextTrainingSignature,
          diet: nextDietSignature,
        };

        if (hasTrainingChanges) {
          setTrainingDays(nextTrainingDays);
          if (viewingDayExercises) {
            const syncedDay = nextTrainingDays.find((day: TrainingDay) => day.dayName === selectedDayName);
            refreshLogFromWeek(syncedDay);
          }
        }
        if (hasDietChanges) {
          setDiet(nextDiet);
        }

        if (hasTrainingChanges && hasDietChanges) {
          showLivePlanNotice("Tu rutina y tu dieta se actualizaron. Vamos con todo, crack.");
        } else if (hasTrainingChanges) {
          showLivePlanNotice("Tu rutina se ha actualizado. Nuevo nivel desbloqueado, dale con todo.");
        } else if (hasDietChanges) {
          showLivePlanNotice("Tu plan de alimentación se actualizó. Seguimos avanzando.");
        }
      } catch {
        // No interrumpimos la experiencia del cliente si una sincronización puntual falla.
      }
    };

    void syncPlan();
    const id = window.setInterval(syncPlan, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [authState, refreshLogFromWeek, selectedClient, selectedDayName, showLivePlanNotice, viewingDayExercises]);

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
    setCompletedSets((prev) =>
      prev.map((set) => {
        if (set.exerciseId !== exerciseId) return set;
        if (setIndex === 0) {
          return { ...set, weight, weightUnit: normalizeWeightUnit(set.weightUnit) };
        }
        if (set.setIndex === setIndex) {
          return { ...set, weight, weightUnit: normalizeWeightUnit(set.weightUnit) };
        }
        return set;
      })
    );
  };

  const getExerciseWeightUnit = (exerciseId: string) => {
    const exerciseSets = completedSets.filter((set) => set.exerciseId === exerciseId);
    const withUnit = exerciseSets.find((set) => set.weightUnit === "lb" || set.weightUnit === "kg");
    return normalizeWeightUnit(withUnit?.weightUnit);
  };

  const updateExerciseWeightUnit = (exerciseId: string, unit: WeightUnit) => {
    if (dayCompleted) return;
    setCompletedSets((prev) => prev.map((set) => set.exerciseId === exerciseId ? { ...set, weightUnit: unit } : set));
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
    if (completed) {
      setShowCongratsGif(true);
      setViewingDayExercises(false);
      setDayCompletionNotice(`Excelente, hoy completaste ${selectedDayName}.`);
      if (dayCompletionTimeoutRef.current !== null) {
        window.clearTimeout(dayCompletionTimeoutRef.current);
      }
      dayCompletionTimeoutRef.current = window.setTimeout(() => {
        setDayCompletionNotice(null);
        dayCompletionTimeoutRef.current = null;
      }, 7000);
      if (congratsGifTimeoutRef.current !== null) {
        window.clearTimeout(congratsGifTimeoutRef.current);
      }
      congratsGifTimeoutRef.current = window.setTimeout(() => {
        setShowCongratsGif(false);
        congratsGifTimeoutRef.current = null;
      }, 2400);
    }
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
    <div className="neon-shell flex min-h-screen items-center justify-center px-4">
      <div className="neon-spinner neon-panel-soft flex items-center gap-4 rounded-full px-5 py-4">
        <Loader2 className="animate-spin text-cyan-300" size={24} />
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">Sincronizando acceso</span>
      </div>
    </div>
  );

  if (authState === "login") return (
    <main className="neon-shell flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="neon-panel neon-outline w-full max-w-md rounded-[2rem] p-8 sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/25 bg-lime-300/10 text-lime-200 shadow-[0_0_30px_rgba(123,255,122,0.16)]">
            <Activity size={28} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-lime-200/70">Client Access</p>
          <h1 className="neon-title mt-3 text-4xl font-extrabold">EMICOACH</h1>
          <p className="neon-copy mt-3 text-sm">Entra a tu rutina diaria, registra tus series y sigue tu progreso desde una interfaz mas potente.</p>
        </div>

        <div className="space-y-4">
          <div className="neon-field">
            <label className="neon-label">Usuario</label>
            <input
              type="text"
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="tu.usuario"
              className="neon-input"
            />
          </div>
          <div className="neon-field">
            <label className="neon-label">Contraseña</label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="••••••••"
              className="neon-input"
            />
          </div>
          {loginError && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{loginError}</p>}
          <button
            onClick={login}
            disabled={loginLoading}
            className="neon-button w-full px-5 py-3.5 text-sm font-bold uppercase tracking-[0.22em]"
          >
            {loginLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Iniciar sesión
          </button>
        </div>
        <p className="mt-6 text-center text-xs uppercase tracking-[0.24em] text-slate-400">Solicita tus datos de acceso a tu coach</p>
      </div>
    </main>
  );

  if (authState === "blocked") return (
    <main className="neon-shell flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="neon-panel w-full max-w-md rounded-[2rem] border border-rose-400/18 p-8 text-center shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/10 text-rose-200 shadow-[0_0_32px_rgba(255,107,125,0.18)]">
          <AlertTriangle size={30} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-200/80">Payment Status</p>
        <h1 className="mt-3 text-2xl font-extrabold uppercase text-white">Acceso suspendido</h1>
        <p className="mt-3 text-sm text-slate-300">Hola {selectedClient?.name?.split(" ")[0]}, tu pago esta vencido y el acceso a tus modulos se detuvo temporalmente.</p>
        {paidUntil && <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Vencio el {new Date(paidUntil + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>}
        <p className="mt-5 text-sm text-slate-400">Contacta a tu coach para reactivar tu cuenta y volver a ver tu rutina, dieta y progreso.</p>
        <button onClick={logout} className="neon-button-secondary mt-7 w-full px-5 py-3 text-sm font-bold uppercase tracking-[0.2em]">
          Cerrar sesión
        </button>
      </div>
    </main>
  );

  if (authState === "deactivated") return (
    <main className="neon-shell flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="neon-panel w-full max-w-md rounded-[2rem] border border-white/10 p-8 text-center shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/6 text-slate-200">
          <AlertTriangle size={30} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-300">Account Status</p>
        <h1 className="mt-3 text-2xl font-extrabold uppercase text-white">Cuenta desactivada</h1>
        <p className="mt-3 text-sm text-slate-300">Hola {selectedClient?.name?.split(" ")[0]}, tu acceso fue desactivado por tu coach.</p>
        <p className="mt-5 text-sm text-slate-400">Contacta a tu coach para mas informacion y reactivar tu cuenta.</p>
        <button onClick={logout} className="neon-button-secondary mt-7 w-full px-5 py-3 text-sm font-bold uppercase tracking-[0.2em]">
          Cerrar sesión
        </button>
      </div>
    </main>
  );

  if (!selectedClient) return null;

  return (
    <main className={`neon-shell min-h-screen ${viewingDayExercises ? "pb-40 sm:pb-44" : "pb-24"}`}>
      {livePlanNotice && (
        <div className="pointer-events-none fixed left-1/2 top-[74px] z-40 w-[min(92vw,560px)] -translate-x-1/2 px-2">
          <div className="pointer-events-auto rounded-2xl border border-lime-300/30 bg-[linear-gradient(180deg,rgba(123,255,122,0.2),rgba(7,16,31,0.92))] px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex items-center gap-2.5">
              <Trophy size={18} className="shrink-0 text-lime-200" />
              <p className="text-sm font-semibold text-lime-100">{livePlanNotice}</p>
            </div>
          </div>
        </div>
      )}

      {showCongratsGif && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/50 px-5">
          <div className="rounded-2xl border border-lime-300/30 bg-[#07101f]/92 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur">
            <img
              src="https://media.giphy.com/media/111ebonMs90YLu/giphy.gif"
              alt="Felicitaciones"
              className="h-36 w-36 rounded-xl border border-lime-300/20 object-cover sm:h-44 sm:w-44"
            />
            <p className="mt-3 text-center text-sm font-bold uppercase tracking-[0.14em] text-lime-100">Dia completado</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="neon-panel-soft sticky top-0 z-20 border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-3 sm:items-center sm:py-3.5">
          <button onClick={logout} className="rounded-xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10 sm:p-3" title="Cerrar sesión">
            <LogOut size={18} className="text-slate-200" />
          </button>
          <div className="min-w-0 flex-1 pt-0.5 sm:pt-0">
            <h2 className="leading-tight text-base font-extrabold uppercase text-white sm:text-lg">{selectedClient.name}</h2>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-[0.2em]">Semana {fmtShort(monday)} – {fmtShort(sunday)} · Emicoach</p>
          </div>
          {!viewingDayExercises && (
            <div className="shrink-0 pt-0.5 text-right sm:pt-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-200/70 sm:text-[10px] sm:tracking-[0.26em]">Progreso</p>
              <p className="text-sm font-extrabold text-white sm:text-base">{completedThisWeek}/{daysWithRoutine.length}</p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-3xl p-4 md:p-6">
        {/* Tab switch */}
        <div className="mb-5 flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/4 p-1.5 backdrop-blur sm:mx-auto sm:w-fit sm:justify-center">
          <button onClick={() => { setTab("training"); setViewingDayExercises(false); }} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all sm:px-5 sm:text-sm sm:tracking-[0.16em] ${tab === "training" ? "bg-cyan-400/16 text-white shadow-[0_0_28px_rgba(49,231,255,0.18)]" : "text-slate-400 hover:text-slate-200"}`}>Entrenamiento</button>
          <button onClick={() => { setTab("diet"); setViewingDayExercises(false); }} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all sm:px-5 sm:text-sm sm:tracking-[0.16em] ${tab === "diet" ? "bg-cyan-400/16 text-white shadow-[0_0_28px_rgba(49,231,255,0.18)]" : "text-slate-400 hover:text-slate-200"}`}>Dieta</button>
          <button onClick={() => { setTab("progress"); setViewingDayExercises(false); }} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all sm:px-5 sm:text-sm sm:tracking-[0.16em] ${tab === "progress" ? "bg-cyan-400/16 text-white shadow-[0_0_28px_rgba(49,231,255,0.18)]" : "text-slate-400 hover:text-slate-200"}`}>Progreso</button>
        </div>

        {/* ==================== TRAINING TAB ==================== */}
        {tab === "training" && !viewingDayExercises && (
          <>
            {dayCompletionNotice && (
              <div className="mb-4 rounded-2xl border border-lime-300/30 bg-lime-300/12 px-4 py-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
                <p className="text-sm font-semibold text-lime-100">{dayCompletionNotice}</p>
              </div>
            )}

            {/* Day selector */}
            <div className="mb-5">
              <h3 className="mb-3 text-base font-extrabold uppercase text-white sm:text-lg">Elige un día</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {DAYS.map(day => {
                  const td = getTrainingDayByName(day);
                  const hasContent = td && td.exercises.length > 0;
                  const completed = td ? isDayCompletedThisWeek(td.id) : false;

                  let style = "bg-[#0b1326]/82 border-white/10 text-slate-300 hover:border-cyan-400/35 hover:bg-cyan-400/8";
                  if (!hasContent) {
                    style = "bg-white/4 border-dashed border-white/10 text-slate-500 cursor-not-allowed opacity-70";
                  } else if (completed) {
                    style = "bg-lime-300/12 border-lime-300/30 text-lime-100 hover:border-lime-300/50 hover:bg-lime-300/18";
                  }

                  return (
                    <button
                      key={day}
                      disabled={!hasContent}
                      onClick={() => hasContent && enterDayDetail(day)}
                      className={`flex min-w-[72px] shrink-0 flex-col items-center rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all sm:min-w-[78px] sm:px-5 sm:py-3 ${style}`}
                    >
                      <span className="text-base">{day.slice(0, 3)}</span>
                      <span className="mt-0.5 text-[10px] font-normal tracking-wide">
                        {completed ? "✓ hecho" : hasContent ? `${td!.exercises.length} ej.` : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week progress bar */}
            {daysWithRoutine.length > 0 && (
              <div className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.26)] sm:p-5">
                <div className="mb-2 flex justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:text-xs sm:tracking-[0.24em]">
                  <span>Progreso semanal</span>
                  <span className={completedThisWeek === daysWithRoutine.length ? "text-lime-200" : "text-white"}>{completedThisWeek}/{daysWithRoutine.length} días</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-cyan-400 to-lime-300 transition-all duration-700" style={{ width: `${daysWithRoutine.length ? (completedThisWeek / daysWithRoutine.length) * 100 : 0}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Se reinicia cada lunes. Los días completados aparecen en verde.</p>
              </div>
            )}
          </>
        )}

        {tab === "training" && viewingDayExercises && (
          <>
            {/* Day detail top bar with progress + back button + wake lock */}
            <div className="sticky top-[69px] z-10 -mx-4 mb-5 flex flex-col gap-2 border-b border-white/10 bg-[#07101f]/92 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <button
                  onClick={backToDays}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 transition-all hover:bg-white/10 hover:text-white sm:text-xs sm:tracking-[0.16em]"
                >
                  <ArrowLeft size={14} />
                  Volver
                </button>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                  <WakeLockToggle autoEnable={true} />
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">{selectedDayName}</p>
                    {totalSets > 0 && (
                      <p className="text-[10px] text-slate-500">{doneSets}/{totalSets} series</p>
                    )}
                  </div>
                  <div className="h-2 w-14 overflow-hidden rounded-full bg-white/10 sm:w-16">
                    <div className={`h-full rounded-full transition-all duration-500 ${dayCompleted ? "bg-lime-300" : "bg-cyan-300"}`} style={{ width: `${totalSets ? (dayCompleted ? 100 : progress) : 0}%` }} />
                  </div>
                </div>
              </div>
              {historyLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Cargando pesos anteriores...
                </div>
              )}
            </div>

            {currentTrainingDay && currentTrainingDay.exercises.length > 0 && (
              <div className="space-y-4">
                {dayCompleted && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-lime-300/24 bg-lime-300/12 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Trophy className="shrink-0 text-lime-200" size={24} />
                      <div>
                        <p className="font-bold text-lime-100">¡Día completado! 🎉</p>
                        <p className="text-xs text-lime-200/80">Se reiniciará el lunes. Puedes desmarcar para volver a entrenar.</p>
                      </div>
                    </div>
                    <button onClick={uncompleteDay} disabled={saving} className="shrink-0 flex items-center gap-1.5 rounded-xl border border-lime-300/24 bg-[#081120] px-3 py-2 text-xs font-bold text-lime-100 transition-colors hover:border-lime-300/45">
                      <RotateCcw size={14} /> Desmarcar
                    </button>
                  </div>
                )}

                {groupedExercises.map((group, groupIdx) => {
                  const isCombo = group.size > 1;
                  const isBiserie = group.size === 2;
                  const isTriserie = group.size === 3;
                  const comboTheme = isBiserie
                    ? {
                        container: "border-orange-300/28 bg-[linear-gradient(180deg,rgba(255,149,0,0.14),rgba(10,16,32,0.88))]",
                        header: "border-orange-300/18 bg-orange-300/10",
                        index: "bg-orange-300/16 text-orange-100",
                        subtitle: "text-orange-100/80",
                        pill: "border-orange-300/24 bg-orange-300/12 text-orange-100",
                        innerCard: "border-orange-300/16",
                        innerHeader: "border-orange-300/12",
                        innerBadge: "bg-orange-300/16 text-orange-100",
                        unitButton: "bg-orange-400/18 text-white shadow-[0_0_18px_rgba(255,149,0,0.2)]",
                      }
                    : isTriserie
                      ? {
                        container: "border-rose-400/28 bg-[linear-gradient(180deg,rgba(255,58,58,0.16),rgba(10,16,32,0.88))]",
                        header: "border-rose-400/18 bg-rose-400/10",
                        index: "bg-rose-400/16 text-rose-100",
                        subtitle: "text-rose-100/80",
                        pill: "border-rose-300/24 bg-rose-300/12 text-rose-100",
                        innerCard: "border-rose-300/16",
                        innerHeader: "border-rose-300/12",
                        innerBadge: "bg-rose-400/16 text-rose-100",
                        unitButton: "bg-rose-400/18 text-white shadow-[0_0_18px_rgba(255,58,58,0.2)]",
                      }
                      : {
                          container: "border-amber-300/30 bg-[linear-gradient(180deg,rgba(255,214,10,0.18),rgba(10,16,32,0.88))]",
                          header: "border-amber-300/22 bg-amber-300/10",
                          index: "bg-amber-300/18 text-amber-100",
                          subtitle: "text-amber-100/85",
                          pill: "border-amber-300/26 bg-amber-300/12 text-amber-100",
                          innerCard: "border-amber-300/18",
                          innerHeader: "border-amber-300/14",
                          innerBadge: "bg-amber-300/18 text-amber-100",
                          unitButton: "bg-amber-400/20 text-white shadow-[0_0_18px_rgba(255,214,10,0.24)]",
                        };

                  return (
                    <div
                      key={group.key}
                      className={`overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur ${
                        isCombo
                          ? comboTheme.container
                          : "border-white/10 bg-[rgba(10,16,32,0.8)]"
                      }`}
                    >
                      <div className={`flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5 ${isCombo ? comboTheme.header : "border-white/8 bg-white/4"}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${isCombo ? comboTheme.index : "bg-cyan-400/14 text-cyan-100"}`}>{groupIdx + 1}</span>
                          <div>
                            <p className="font-bold text-white">{isCombo ? getSessionLabel(group.size) : group.exercises[0]?.name}</p>
                            {isCombo ? (
                              <p className={`text-[11px] uppercase tracking-[0.16em] ${comboTheme.subtitle}`}>{group.exercises.length} ejercicios encadenados</p>
                            ) : null}
                          </div>
                        </div>
                        {isCombo ? (
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${comboTheme.pill}`}>
                            {`${getSessionLabel(group.size)} X${group.size}`}
                          </span>
                        ) : null}
                      </div>

                      {isCombo ? (
                        <div className="space-y-3 p-3 sm:p-4">
                          {group.exercises.map((ex, exIdx) => (
                            <div key={ex.id} className={`overflow-hidden rounded-[1.4rem] border bg-[#091120]/88 ${comboTheme.innerCard}`}>
                              <div className={`flex items-center gap-3 border-b bg-white/4 px-4 py-3.5 sm:px-5 ${comboTheme.innerHeader}`}>
                                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${comboTheme.innerBadge}`}>
                                  {String.fromCharCode(65 + exIdx)}
                                </span>
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                  <span className="truncate font-bold text-white">{ex.name}</span>
                                  {ex.type !== "time" && (
                                    <div className="flex rounded-full border border-white/10 bg-white/4 p-1">
                                      {(["kg", "lb"] as WeightUnit[]).map((unit) => (
                                        <button
                                          key={unit}
                                          onClick={() => updateExerciseWeightUnit(ex.id, unit)}
                                          disabled={dayCompleted}
                                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${getExerciseWeightUnit(ex.id) === unit ? comboTheme.unitButton : "text-slate-400 hover:text-slate-200"}`}
                                        >
                                          {unit === "kg" ? "KG" : "LB"}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {ex.type !== "time" && (
                                <RestTimer exerciseId={ex.id} exerciseName={ex.name || `${getSessionLabel(group.size)} ${exIdx + 1}`} triggerTimestamp={timerTriggers[ex.id]} disabled={dayCompleted} />
                              )}
                              <div className="space-y-3 p-4 sm:p-5">
                                <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-wider">
                                  <span className="col-span-1">S.</span>
                                  <span className="col-span-4">Reps</span>
                                  <span className="col-span-5">{ex.type === "time" ? "Tiempo" : "Mi peso"}</span>
                                  <span className="col-span-2 text-center">✓</span>
                                </div>
                                {ex.sets.map((s, sIdx) => {
                                  const cs = getSet(ex.id, sIdx);
                                  const prevKey = `${ex.id}-${sIdx}`;
                                  const prevWeight = prevWeights[prevKey];
                                  const showPrev = prevWeight?.weight && (!cs?.weight || cs.weight === prevWeight.weight);
                                  const isTimeExercise = ex.type === "time";
                                  return (
                                    <div key={sIdx} className={`grid grid-cols-12 items-start gap-2 rounded-xl p-2 transition-colors ${cs?.done ? "bg-lime-300/10" : "bg-white/3"}`}>
                                      <span className="col-span-1 pt-2 text-sm font-mono text-slate-500">#{sIdx + 1}</span>
                                      <span className="col-span-4 pt-2 text-xs font-medium text-slate-200 sm:text-sm">{s.reps}</span>
                                      <div className="col-span-5 space-y-1">
                                        {isTimeExercise ? (
                                          <div className="rounded-xl border border-dashed border-white/12 bg-[#091120]/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                            Minutos
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <input type="text" placeholder={prevWeight?.weight ? `Últ: ${formatWeightWithUnit(prevWeight.weight, prevWeight.unit)}` : getExerciseWeightUnit(ex.id)} value={cs?.weight ?? ""} onChange={e => updateWeight(ex.id, sIdx, e.target.value)} disabled={dayCompleted} className="w-full rounded-xl border border-white/10 bg-[#091120] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/12 disabled:bg-white/5 disabled:text-slate-500" />
                                            <span className="rounded-lg border border-white/10 bg-[#091120] px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                                              {normalizeWeightUnit(cs?.weightUnit ?? getExerciseWeightUnit(ex.id))}
                                            </span>
                                          </div>
                                        )}
                                        {!isTimeExercise && showPrev && (
                                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <History size={10} /> Anterior: <span className="font-bold">{formatWeightWithUnit(prevWeight.weight, prevWeight.unit)}</span>
                                          </div>
                                        )}
                                      </div>
                                      <button onClick={() => toggleSet(ex.id, sIdx)} disabled={dayCompleted} className={`col-span-2 mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-xl border-2 transition-all ${cs?.done ? "border-lime-300 bg-lime-300 text-slate-950" : "border-white/16 text-transparent hover:border-cyan-300/50"}`}>
                                        <Check size={16} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        group.exercises.map((ex) => (
                          <div key={ex.id}>
                            {ex.type !== "time" && (
                              <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/4 px-4 py-3 sm:px-5">
                                <p className="font-bold text-white">Unidad del ejercicio</p>
                                <div className="flex rounded-full border border-white/10 bg-white/4 p-1">
                                  {(["kg", "lb"] as WeightUnit[]).map((unit) => (
                                    <button
                                      key={unit}
                                      onClick={() => updateExerciseWeightUnit(ex.id, unit)}
                                      disabled={dayCompleted}
                                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${getExerciseWeightUnit(ex.id) === unit ? "bg-cyan-400/18 text-white shadow-[0_0_18px_rgba(49,231,255,0.16)]" : "text-slate-400 hover:text-slate-200"}`}
                                    >
                                      {unit === "kg" ? "KG" : "LB"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {ex.type !== "time" && (
                              <RestTimer exerciseId={ex.id} exerciseName={ex.name || `Ejercicio ${groupIdx + 1}`} triggerTimestamp={timerTriggers[ex.id]} disabled={dayCompleted} />
                            )}
                            <div className="space-y-3 p-4 sm:p-5">
                              <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-wider">
                                <span className="col-span-1">S.</span>
                                <span className="col-span-4">Reps</span>
                                <span className="col-span-5">{ex.type === "time" ? "Tiempo" : "Mi peso"}</span>
                                <span className="col-span-2 text-center">✓</span>
                              </div>
                              {ex.sets.map((s, sIdx) => {
                                const cs = getSet(ex.id, sIdx);
                                const prevKey = `${ex.id}-${sIdx}`;
                                const prevWeight = prevWeights[prevKey];
                                const showPrev = prevWeight?.weight && (!cs?.weight || cs.weight === prevWeight.weight);
                                const isTimeExercise = ex.type === "time";
                                return (
                                  <div key={sIdx} className={`grid grid-cols-12 items-start gap-2 rounded-xl p-2 transition-colors ${cs?.done ? "bg-lime-300/10" : "bg-white/3"}`}>
                                    <span className="col-span-1 pt-2 text-sm font-mono text-slate-500">#{sIdx + 1}</span>
                                    <span className="col-span-4 pt-2 text-xs font-medium text-slate-200 sm:text-sm">{s.reps}</span>
                                    <div className="col-span-5 space-y-1">
                                      {isTimeExercise ? (
                                        <div className="rounded-xl border border-dashed border-white/12 bg-[#091120]/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                          Minutos
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <input type="text" placeholder={prevWeight?.weight ? `Últ: ${formatWeightWithUnit(prevWeight.weight, prevWeight.unit)}` : getExerciseWeightUnit(ex.id)} value={cs?.weight ?? ""} onChange={e => updateWeight(ex.id, sIdx, e.target.value)} disabled={dayCompleted} className="w-full rounded-xl border border-white/10 bg-[#091120] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/35 focus:ring-2 focus:ring-cyan-400/12 disabled:bg-white/5 disabled:text-slate-500" />
                                          <span className="rounded-lg border border-white/10 bg-[#091120] px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                                            {normalizeWeightUnit(cs?.weightUnit ?? getExerciseWeightUnit(ex.id))}
                                          </span>
                                        </div>
                                      )}
                                      {!isTimeExercise && showPrev && (
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                          <History size={10} /> Anterior: <span className="font-bold">{formatWeightWithUnit(prevWeight.weight, prevWeight.unit)}</span>
                                        </div>
                                      )}
                                    </div>
                                    <button onClick={() => toggleSet(ex.id, sIdx)} disabled={dayCompleted} className={`col-span-2 mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-xl border-2 transition-all ${cs?.done ? "border-lime-300 bg-lime-300 text-slate-950" : "border-white/16 text-transparent hover:border-cyan-300/50"}`}>
                                      <Check size={16} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ==================== DIET TAB ==================== */}
        {tab === "diet" && (
          <>
            <div className="mb-4">
              <h3 className="text-base font-extrabold text-white sm:text-lg">Tu Plan de Alimentación</h3>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">Dieta general · Aplica todos los días</p>
            </div>

            {!diet || diet.meals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/14 bg-white/4 py-16 text-center">
                <p className="text-4xl mb-3">🥗</p>
                <p className="font-semibold text-white">Sin dieta asignada</p>
                <p className="mt-1 text-sm text-slate-400">Tu coach aún no ha asignado un plan de alimentación.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diet.meals.map((meal, idx) => (
                  <div key={meal.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(10,16,32,0.8)] shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur">
                    <div className="flex items-center gap-3 border-b border-white/8 bg-white/4 px-4 py-4 sm:px-5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-300/14 text-xs font-bold text-lime-100">{idx + 1}</span>
                      <span className="font-bold text-white">{meal.time}</span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <p className="text-[15px] leading-8 text-slate-200 sm:text-base sm:leading-relaxed">{meal.description}</p>
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
            <section className="neon-panel-soft rounded-2xl border border-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <TrendingDown size={18} className="text-lime-200" />
                  <div>
                    <h3 className="font-bold text-white">Peso y medidas</h3>
                    <p className="text-xs text-slate-400">Registra tu progreso corporal</p>
                  </div>
                </div>
                <button onClick={() => setShowAddBody(true)} className="neon-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]">
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
                    color="#31e7ff"
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
                    color="#7bff7a"
                  />
                </div>
              )}

              {bodyData.length === 0 && !showAddBody && (
                <p className="py-8 text-center text-sm text-slate-400">Sin registros aún. Agrega tu primer registro de peso y medidas.</p>
              )}

              {bodyData.length > 0 && (
                <div className="space-y-2">
                  {bodyData.map(b => (
                    <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
                      <div>
                        <p className="font-bold text-white">{new Date(b.recordDate + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {b.weight && <span className="font-semibold">{b.weight} kg</span>}
                          {b.waist && <span> · Cintura {b.waist}cm</span>}
                          {b.hip && <span> · Cadera {b.hip}cm</span>}
                          {b.arm && <span> · Brazo {b.arm}cm</span>}
                          {b.thigh && <span> · Muslo {b.thigh}cm</span>}
                        </p>
                      </div>
                      <button onClick={() => deleteBody(b.id)} className="text-slate-500 hover:text-rose-300">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddBody && <BodyForm onSave={saveBody} onCancel={() => setShowAddBody(false)} />}
            </section>

            {/* InBody */}
            <section className="neon-panel-soft rounded-2xl border border-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3 sm:items-center">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-fuchsia-200" />
                  <div>
                    <h3 className="font-bold text-white">InBody / Composición corporal</h3>
                    <p className="text-xs text-slate-400">Registra tu InBody mensual</p>
                  </div>
                </div>
                <button onClick={() => setShowAddInBody(true)} className="neon-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]">
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
                      color="#ff4fd8"
                    />
                  </div>
                  <div className="mb-5">
                    <ProgressChart
                      data={inbodyData.filter(i => i.muscleMass).map(i => ({ date: i.recordDate, value: Number(i.muscleMass) })).reverse()}
                      label="Masa Muscular"
                      unit="kg"
                      color="#7bff7a"
                    />
                  </div>
                </>
              )}

              {inbodyData.length === 0 && !showAddInBody && (
                <p className="py-8 text-center text-sm text-slate-400">Sin registros aún. Agrega tu primer InBody.</p>
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

      {/* Bottom action: always visible during the workout, enabled only at 100% */}
      {tab === "training" && viewingDayExercises && currentTrainingDay && currentTrainingDay.exercises.length > 0 && !dayCompleted && (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-3 z-30 px-3 sm:bottom-4 sm:px-4">
          <div className="pointer-events-auto mx-auto max-w-3xl rounded-[1.4rem] border border-white/10 bg-[#07101f]/94 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <span>Terminar rutina</span>
              <span>{doneSets}/{totalSets} series completas</span>
            </div>
            <button
              onClick={() => saveLog(true)}
              disabled={saving || progress < 100}
              className="neon-button w-full justify-center px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
              {progress === 100 ? "Marcar día completo" : "Completa todas las series para terminar"}
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
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-200/70">Nuevo registro</p>
      <div>
        <label className="neon-label">Fecha</label>
        <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="neon-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="neon-label">Peso (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="72.5" className="neon-input" /></div>
        <div><label className="neon-label">Cintura (cm)</label><input type="number" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} placeholder="80" className="neon-input" /></div>
        <div><label className="neon-label">Cadera (cm)</label><input type="number" step="0.1" value={hip} onChange={e => setHip(e.target.value)} placeholder="95" className="neon-input" /></div>
        <div><label className="neon-label">Brazo (cm)</label><input type="number" step="0.1" value={arm} onChange={e => setArm(e.target.value)} placeholder="32" className="neon-input" /></div>
        <div><label className="neon-label">Muslo (cm)</label><input type="number" step="0.1" value={thigh} onChange={e => setThigh(e.target.value)} placeholder="55" className="neon-input" /></div>
        <div><label className="neon-label">Pecho (cm)</label><input type="number" step="0.1" value={chest} onChange={e => setChest(e.target.value)} placeholder="95" className="neon-input" /></div>
      </div>
      <div><label className="neon-label">Notas (opcional)</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="neon-input" /></div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave({ recordDate, weight, waist, hip, arm, thigh, chest, notes })} className="neon-button px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Guardar</button>
        <button onClick={onCancel} className="neon-button-secondary px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Cancelar</button>
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
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-200/70">Nuevo InBody</p>
      <div>
        <label className="neon-label">Fecha</label>
        <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="neon-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="neon-label">Peso (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="72.5" className="neon-input" /></div>
        <div><label className="neon-label">Grasa corporal (%)</label><input type="number" step="0.1" value={bodyFatPercent} onChange={e => setBodyFat(e.target.value)} placeholder="18.5" className="neon-input" /></div>
        <div><label className="neon-label">Masa muscular (kg)</label><input type="number" step="0.1" value={muscleMass} onChange={e => setMuscle(e.target.value)} placeholder="32" className="neon-input" /></div>
        <div><label className="neon-label">IMC</label><input type="number" step="0.1" value={bmi} onChange={e => setBmi(e.target.value)} placeholder="22.5" className="neon-input" /></div>
        <div><label className="neon-label">Agua corporal (%)</label><input type="number" step="0.1" value={bodyWaterPercent} onChange={e => setWater(e.target.value)} placeholder="60" className="neon-input" /></div>
        <div><label className="neon-label">Tasa metabólica (kcal)</label><input type="number" value={bmr} onChange={e => setBmr(e.target.value)} placeholder="1700" className="neon-input" /></div>
        <div><label className="neon-label">Grasa visceral</label><input type="number" step="1" value={visceralFat} onChange={e => setVisceral(e.target.value)} placeholder="5" className="neon-input" /></div>
        <div><label className="neon-label">Edad corporal</label><input type="number" step="1" value={bodyAge} onChange={e => setBodyAge(e.target.value)} placeholder="25" className="neon-input" /></div>
      </div>
      <div><label className="neon-label">Notas (opcional)</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: buen progreso de fuerza" className="neon-input" /></div>
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
        })} className="neon-button px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Guardar</button>
        <button onClick={onCancel} className="neon-button-secondary px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Cancelar</button>
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/4">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between p-4 transition-colors hover:bg-white/6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-300/14 text-xs font-bold text-fuchsia-100">
            {new Date(record.recordDate + "T00:00").toLocaleDateString("es-MX", { month: "short" }).toUpperCase().slice(0, 3)}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">
              {new Date(record.recordDate + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-xs text-slate-400">
              {record.weight && <span>{record.weight} kg</span>}
              {record.bodyFatPercent && <span> · {record.bodyFatPercent}% grasa</span>}
              {record.muscleMass && <span> · {record.muscleMass}kg músculo</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div onClick={e => { e.stopPropagation(); onDelete(); }} className="cursor-pointer p-1 text-slate-500 transition-colors hover:text-rose-300">
            <Trash2 size={14} />
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-white/8 bg-[#091120] p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map(m => (
              <div key={m.label} className="rounded-lg border border-white/10 bg-white/4 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{m.label}</p>
                <p className="text-lg font-black text-white">{m.value}<span className="ml-1 text-xs text-slate-500">{m.unit}</span></p>
              </div>
            ))}
          </div>
          {record.notes && (
            <p className="mt-3 text-sm italic text-slate-400">"{record.notes}"</p>
          )}
        </div>
      )}
    </div>
  );
}
