"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Save, ArrowLeft, User, ChevronRight, Loader2,
  Check, ChevronLeft, ChevronDown, TrendingDown, Activity,
  LayoutDashboard, Users, CreditCard, AlertTriangle, KeyRound, Copy,
} from "lucide-react";
import type { Exercise, Meal, TemplateTrainingDay } from "@/db/schema";
import { PERIODICITY_OPTIONS, fmtDate, daysBetween, todayISO, type PaymentStatus } from "@/lib/payments";
import ProgressChart from "@/components/ProgressChart";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_ABBR: Record<string, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue",
  Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDaysDate(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtShort(d: Date) {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

type Client = { id: number; name: string; username: string; monthlyFee: string; periodicityDays: number; startDate: string; isActive?: boolean };
type TrainingDay = { id?: number; clientId: number; dayName: string; displayName?: string; exercises: Exercise[] };
type Diet = { id?: number; clientId: number; meals: Meal[] };

type LogRow = { id: number; clientId: number; trainingDayId: number; logDate: string; dayCompleted: boolean; completedSets: unknown };
type BodyRow = { id: number; clientId: number; recordDate: string; weight: string | null; waist: string | null; hip: string | null; arm: string | null; thigh: string | null; chest: string | null; notes: string | null };
type InBodyRow = { id: number; clientId: number; recordDate: string; weight: string | null; bodyFatPercent: string | null; muscleMass: string | null; bmi: string | null; bodyWaterPercent: string | null; bmr: string | null; visceralFat: string | null; bodyAge: number | null; notes: string | null };
type ClientProgress = { client: { id: number; name: string }; logs: LogRow[]; bodyProgress: BodyRow[]; inbody: InBodyRow[] };

type PaymentStatusRow = {
  id: number; name: string; username: string; monthlyFee: string; periodicityDays: number;
  startDate: string; paidUntil: string | null; status: PaymentStatus; lastPaymentDate: string | null;
  isActive: boolean;
};
type WorkoutTemplate = { id: number; name: string; description: string | null; trainingDays: TemplateTrainingDay[]; meals: Meal[]; createdAt: string | null };

type ExerciseSessionSize = number;
type ExerciseGroup = { key: string; exercises: Exercise[]; size: ExerciseSessionSize };

type MainView = "dashboard" | "clientes" | "pagos" | "plantillas";
type ClientTab = "training" | "diet" | "progress" | "info";

const STATUS_STYLE: Record<PaymentStatus, { bg: string; text: string; label: string; dot: string }> = {
  activo: { bg: "bg-green-50", text: "text-green-700", label: "Activo", dot: "bg-green-500" },
  por_vencer: { bg: "bg-amber-50", text: "text-amber-700", label: "Por vencer", dot: "bg-amber-500" },
  vencido: { bg: "bg-red-50", text: "text-red-700", label: "Vencido", dot: "bg-red-500" },
};

function createExercise(sessionId?: string, sessionSize: ExerciseSessionSize = 1): Exercise {
  return {
    id: crypto.randomUUID(),
    name: "",
    notes: "",
    type: "reps",
    sessionId,
    sessionSize,
    sets: [{ reps: "12" }],
  };
}

function getExerciseSessionKey(exercise: Exercise) {
  return exercise.sessionId ?? exercise.id;
}

function normalizeExerciseSessions(exercises: Exercise[]) {
  const sessionCounts = new Map<string, number>();
  for (const exercise of exercises) {
    if (!exercise.sessionId) continue;
    sessionCounts.set(exercise.sessionId, (sessionCounts.get(exercise.sessionId) ?? 0) + 1);
  }

  return exercises.map((exercise) => {
    if (!exercise.sessionId) return { ...exercise, sessionSize: 1 as ExerciseSessionSize };
    const nextSize = Math.max(1, sessionCounts.get(exercise.sessionId) ?? 1) as ExerciseSessionSize;
    return { ...exercise, sessionSize: nextSize };
  });
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
    return { ...group, size: Math.max(1, group.exercises.length) as ExerciseSessionSize };
  });
}

function getSessionLabel(size: ExerciseSessionSize) {
  if (size === 2) return "Biserie";
  if (size === 3) return "Triserie";
  if (size >= 4) return "Superserie";
  return "Ejercicio";
}

export default function CoachPage() {
  // --- Coach Auth ---
  const [coachAuth, setCoachAuth] = useState<"checking" | "login" | "ok">("checking");
  const [coachUser, setCoachUser] = useState("");
  const [coachPass, setCoachPass] = useState("");
  const [coachError, setCoachError] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);

  const [mainView, setMainView] = useState<MainView>("dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatusRow[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientTab, setClientTab] = useState<ClientTab>("training");
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [progress, setProgress] = useState<ClientProgress | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("Lunes");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [showAddBody, setShowAddBody] = useState(false);
  const [showAddInBody, setShowAddInBody] = useState(false);
  const [payingClient, setPayingClient] = useState<PaymentStatusRow | null>(null);
  const [showExerciseMenu, setShowExerciseMenu] = useState(false);
  const [superserieCount, setSuperserieCount] = useState("4");
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<WorkoutTemplate | null>(null);

  const resetCoachSession = useCallback(() => {
    localStorage.removeItem("emicoach-coach-session");
    setCoachAuth("login");
    setCoachUser("");
    setCoachPass("");
    setClients([]);
    setPaymentStatuses([]);
    setSelectedClient(null);
    setCoachError("Tu sesión expiró. Inicia sesión de nuevo.");
  }, []);

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    if (res.status === 401) {
      resetCoachSession();
      return;
    }
    if (!res.ok) {
      setClients([]);
      return;
    }
    const data: unknown = await res.json();
    setClients(Array.isArray(data) ? data : []);
  }, [resetCoachSession]);

  const loadPaymentStatuses = useCallback(async () => {
    const res = await fetch("/api/payments/status");
    if (res.status === 401) {
      resetCoachSession();
      return;
    }
    if (!res.ok) {
      setPaymentStatuses([]);
      return;
    }
    const data: unknown = await res.json();
    setPaymentStatuses(Array.isArray(data) ? data : []);
  }, [resetCoachSession]);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (!res.ok) {
      setTemplates([]);
      return;
    }
    const data: unknown = await res.json();
    setTemplates(Array.isArray(data) ? data as WorkoutTemplate[] : []);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("emicoach-coach-session");
    if (saved) {
      setCoachAuth("ok");
    } else {
      setCoachAuth("login");
    }
  }, []);

  useEffect(() => {
    if (coachAuth === "ok") {
      loadClients();
      loadPaymentStatuses();
      loadTemplates();
    }
  }, [coachAuth, loadClients, loadPaymentStatuses, loadTemplates]);

  const coachLogin = async () => {
    setCoachError("");
    if (!coachUser || !coachPass) {
      setCoachError("Ingresa usuario y contraseña");
      return;
    }
    setCoachLoading(true);
    const res = await fetch("/api/auth/coach-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: coachUser, password: coachPass }),
    });
    setCoachLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setCoachError(d.error ?? "Credenciales incorrectas");
      return;
    }
    const data = await res.json();
    // Solo guardamos el username para la UI — el token de auth viaja en la cookie HttpOnly
    localStorage.setItem("emicoach-coach-session", JSON.stringify({ username: data.username }));
    setCoachAuth("ok");
  };

  const coachLogout = async () => {
    await fetch("/api/auth/coach-logout", { method: "POST" });
    resetCoachSession();
  };

  const openClient = useCallback(async (client: Client) => {
    setLoading(true);
    try {
      const [tdRes, dietRes] = await Promise.all([
        fetch(`/api/training-days?clientId=${client.id}`),
        fetch(`/api/diet?clientId=${client.id}`),
      ]);
      const td = tdRes.ok ? await tdRes.json() : [];
      const diet = dietRes.ok ? await dietRes.json() : null;
      setTrainingDays(td);
      setDiet(diet ?? { clientId: client.id, meals: [] });
      setSelectedClient(client);
      setSelectedDay("Lunes");
      setClientTab("training");
      setWeekStart(getMonday(new Date()));
      setProgress(null);
      setLoading(false);
    } catch (error) {
      console.error("Error opening client:", error);
      setLoading(false);
    }
  }, []);

  const loadProgress = useCallback(async (clientId: number) => {
    try {
      const res = await fetch(`/api/client-progress?clientId=${clientId}`);
      const data = res.ok ? await res.json() : null;
      setProgress(data);
    } catch (error) {
      console.error("Error loading progress:", error);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    if (clientTab === "progress" && selectedClient) loadProgress(selectedClient.id);
  }, [clientTab, selectedClient, loadProgress]);

  // --- Training helpers ---
  const currentTraining = trainingDays.find(d => d.dayName === selectedDay);
  const currentExerciseGroups = groupExercisesBySession(currentTraining?.exercises ?? []);
  const updateTraining = (updater: (day: TrainingDay) => TrainingDay) => {
    setTrainingDays(prev => {
      const exists = prev.find(d => d.dayName === selectedDay);
      if (exists) return prev.map(d => d.dayName === selectedDay ? updater(d) : d);
      const fresh: TrainingDay = { clientId: selectedClient!.id, dayName: selectedDay, exercises: [] };
      return [...prev, updater(fresh)];
    });
  };
  const updateExerciseSession = (exId: string, updater: (exercises: Exercise[], target: Exercise, sessionMembers: Exercise[]) => Exercise[]) => {
    updateTraining(day => {
      const target = day.exercises.find(ex => ex.id === exId);
      if (!target) return day;
      const sessionKey = getExerciseSessionKey(target);
      const sessionMembers = day.exercises.filter(ex => getExerciseSessionKey(ex) === sessionKey);
      return { ...day, exercises: normalizeExerciseSessions(updater(day.exercises, target, sessionMembers)) };
    });
  };
  const addExerciseGroup = (size: ExerciseSessionSize) => {
    setShowExerciseMenu(false);
    updateTraining(day => {
      if (size === 1) return { ...day, exercises: [...day.exercises, createExercise()] };
      const sessionId = crypto.randomUUID();
      const nextExercises = Array.from({ length: size }, () => createExercise(sessionId, size));
      return { ...day, exercises: [...day.exercises, ...nextExercises] };
    });
  };
  const addSuperserieGroup = () => {
    const parsed = Number.parseInt(superserieCount, 10);
    const size = Number.isFinite(parsed) ? Math.max(4, parsed) : 4;
    addExerciseGroup(size);
    setSuperserieCount("4");
  };
  const updateExerciseName = (exId: string, name: string) => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, name } : ex) }));
  const updateExerciseNotes = (exId: string, notes: string) => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, notes } : ex) }));
  const updateExerciseType = (exId: string, type: "reps" | "time") => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, type } : ex) }));
  const addSet = (exId: string) => updateTraining(day => ({
    ...day,
    exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, sets: [...ex.sets, { reps: ex.sets[ex.sets.length - 1]?.reps || "12" }] } : ex),
  }));
  const removeSet = (exId: string, setIdx: number) => updateTraining(day => ({
    ...day,
    exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) } : ex),
  }));
  const updateSetReps = (exId: string, setIdx: number, reps: string) => updateTraining(day => ({
    ...day,
    exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map((s, i) => i === setIdx ? { reps } : s) } : ex),
  }));
  const removeExercise = (exId: string) => updateTraining(day => ({ ...day, exercises: normalizeExerciseSessions(day.exercises.filter(ex => ex.id !== exId)) }));
  const updateTrainingDayDisplayName = (displayName: string) => setTrainingDays(prev => prev.map(d => d.dayName === selectedDay ? { ...d, displayName } : d));

  // --- Diet helpers ---
  const addMeal = () => { if (!diet) return; setDiet({ ...diet, meals: [...diet.meals, { id: crypto.randomUUID(), time: "08:00", description: "" }] }); };
  const updateMeal = (mealId: string, field: "time" | "description", value: string) => { if (!diet) return; setDiet({ ...diet, meals: diet.meals.map(m => m.id === mealId ? { ...m, [field]: value } : m) }); };
  const removeMeal = (mealId: string) => { if (!diet) return; setDiet({ ...diet, meals: diet.meals.filter(m => m.id !== mealId) }); };

  const save = async () => {
    setSaving(true);
    const allDays = DAYS.map(d => ({ training: trainingDays.find(t => t.dayName === d), dayName: d }));
    await Promise.all(allDays.flatMap(({ training, dayName }) => {
      const ops: Promise<unknown>[] = [];
      if (training) {
        if (training.id) {
          ops.push(fetch(`/api/training-days/${training.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayName, displayName: training.displayName, exercises: training.exercises }) }));
        } else {
          ops.push(fetch("/api/training-days", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selectedClient!.id, dayName, displayName: training.displayName, exercises: training.exercises }) }));
        }
      }
      return ops;
    }));
    if (diet) {
      await fetch("/api/diet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selectedClient!.id, meals: diet.meals }) });
    }
    const [td, dietRes] = await Promise.all([
      fetch(`/api/training-days?clientId=${selectedClient!.id}`).then(r => r.json()),
      fetch(`/api/diet?clientId=${selectedClient!.id}`).then(r => r.json()),
    ]);
    setTrainingDays(td);
    setDiet(dietRes ?? { clientId: selectedClient!.id, meals: [] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // --- Progress helpers ---
  const saveBodyProgress = async (data: Partial<BodyRow> & { recordDate: string }) => {
    await fetch("/api/body-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selectedClient!.id, ...data }) });
    setShowAddBody(false);
    if (selectedClient) await loadProgress(selectedClient.id);
  };
  const saveInBody = async (data: Partial<InBodyRow> & { recordDate: string }) => {
    await fetch("/api/inbody", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selectedClient!.id, ...data }) });
    setShowAddInBody(false);
    if (selectedClient) await loadProgress(selectedClient.id);
  };
  const deleteBody = async (id: number) => { await fetch(`/api/body-progress?id=${id}`, { method: "DELETE" }); if (selectedClient) await loadProgress(selectedClient.id); };
  const deleteInBody = async (id: number) => { await fetch(`/api/inbody?id=${id}`, { method: "DELETE" }); if (selectedClient) await loadProgress(selectedClient.id); };

  // --- Payments ---
  const registerPayment = async (clientId: number, amount: string, paymentDate: string) => {
    await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, amount, paymentDate }) });
    setPayingClient(null);
    await loadPaymentStatuses();
  };

  const deleteTemplate = async (templateId: number) => {
    await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    if (previewTemplate?.id === templateId) setPreviewTemplate(null);
    await loadTemplates();
  };

  // ===================== DASHBOARD STATS =====================
  const totalClients = paymentStatuses.length;
  const activeClients = paymentStatuses.filter(c => c.status !== "vencido").length;
  const pendingClients = paymentStatuses.filter(c => c.status === "vencido").length;
  const upcomingClients = paymentStatuses.filter(c => c.status === "por_vencer");

  // ===================== RENDER =====================

  if (coachAuth === "checking") {
    return (
      <div className="neon-shell flex min-h-screen items-center justify-center px-4">
        <div className="neon-spinner neon-panel-soft flex items-center gap-4 rounded-full px-5 py-4">
          <Loader2 className="animate-spin text-cyan-300" size={22} />
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">Cargando acceso coach</span>
        </div>
      </div>
    );
  }

  if (coachAuth === "login") {
    return (
      <main className="neon-shell flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="neon-panel neon-outline w-full max-w-md rounded-[2rem] p-8 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200 shadow-[0_0_30px_rgba(49,231,255,0.18)]">
              <KeyRound size={28} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-200/70">Coach Access</p>
            <h1 className="neon-title mt-3 text-4xl font-extrabold">EMICOACH</h1>
            <p className="neon-copy mt-3 text-sm">Acceso privado para operar clientes, pagos, progreso y programacion semanal.</p>
          </div>

          <div className="space-y-4">
            <div className="neon-field">
              <label className="neon-label">Usuario coach</label>
              <input type="text" value={coachUser} onChange={e => setCoachUser(e.target.value)} onKeyDown={e => e.key === "Enter" && coachLogin()} placeholder="coach" className="neon-input" />
            </div>
            <div className="neon-field">
              <label className="neon-label">Contraseña</label>
              <input type="password" value={coachPass} onChange={e => setCoachPass(e.target.value)} onKeyDown={e => e.key === "Enter" && coachLogin()} placeholder="••••••••" className="neon-input" />
            </div>
            {coachError && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{coachError}</p>}
            <button onClick={coachLogin} disabled={coachLoading} className="neon-button w-full px-5 py-3.5 text-sm font-bold uppercase tracking-[0.22em]">
              {coachLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              Entrar como Coach
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="neon-shell min-h-screen">
      {/* Top Bar */}
      <div className="neon-panel-soft sticky top-0 z-30 border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-3.5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold uppercase text-white">EMICOACH</h1>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100">Coach</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedClient && mainView === "clientes" && (
              <button onClick={save} disabled={saving || saved || clientTab === "progress" || clientTab === "info"} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] transition-all ${clientTab === "progress" || clientTab === "info" ? "hidden" : ""} ${saved ? "bg-green-600 text-white" : "neon-button"}`}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
                {saving ? "Guardando..." : saved ? "Guardado" : "Guardar"}
              </button>
            )}
            <button onClick={coachLogout} className="rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-400/35 hover:bg-white/8 hover:text-white">
              Salir
            </button>
          </div>
        </div>
        {/* Main nav */}
        {!selectedClient && (
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
            {([
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "clientes", label: "Clientes", icon: Users },
              { id: "pagos", label: "Pagos", icon: CreditCard },
              { id: "plantillas", label: "Plantillas", icon: Copy },
            ] as { id: MainView; label: string; icon: typeof LayoutDashboard }[]).map(v => (
              <button key={v.id} onClick={() => setMainView(v.id)} className={`whitespace-nowrap flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all sm:text-sm sm:tracking-[0.16em] ${mainView === v.id ? "bg-cyan-400/16 text-white shadow-[0_0_24px_rgba(49,231,255,0.18)]" : "text-slate-400 hover:bg-white/6 hover:text-slate-100"}`}>
                <v.icon size={15} /> {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-6xl p-4 md:p-6">
        {/* ============ DASHBOARD ============ */}
        {!selectedClient && mainView === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-6">
                <div className="mb-2 flex items-center gap-2 text-slate-400"><Users size={16} /><span className="text-xs font-bold uppercase tracking-[0.24em]">Total Clientes</span></div>
                <p className="text-4xl font-extrabold text-white">{totalClients}</p>
              </div>
              <div className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-6">
                <div className="mb-2 flex items-center gap-2 text-lime-200"><Check size={16} /><span className="text-xs font-bold uppercase tracking-[0.24em]">Clientes Activos</span></div>
                <p className="text-4xl font-extrabold text-lime-200">{activeClients}</p>
              </div>
              <div className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-6">
                <div className="mb-2 flex items-center gap-2 text-rose-200"><AlertTriangle size={16} /><span className="text-xs font-bold uppercase tracking-[0.24em]">Pendientes de Pago</span></div>
                <p className="text-4xl font-extrabold text-rose-200">{pendingClients}</p>
              </div>
            </div>

            {upcomingClients.length > 0 && (
              <div className="neon-panel-soft rounded-[1.6rem] border border-amber-300/20 p-5">
                <h3 className="mb-3 flex items-center gap-2 font-bold text-white"><AlertTriangle size={16} className="text-amber-300" /> Por vencer pronto</h3>
                <div className="space-y-2">
                  {upcomingClients.map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-amber-300/12 bg-amber-300/8 p-3 text-sm">
                      <span className="font-semibold text-slate-100">{c.name}</span>
                      <span className="font-medium text-amber-200">Vence {c.paidUntil ? fmtDate(c.paidUntil) : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-5">
              <h3 className="mb-3 font-bold text-white">Resumen de clientes</h3>
              <div className="space-y-2">
                {paymentStatuses.map(c => {
                  const s = STATUS_STYLE[c.status];
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
                      <span className="font-semibold text-slate-100">{c.name}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                  );
                })}
                {paymentStatuses.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aún no hay clientes registrados</p>}
              </div>
            </div>
          </div>
        )}

        {/* ============ CLIENTES LIST ============ */}
        {!selectedClient && mainView === "clientes" && (
          <div>
            <div className="mb-6 flex items-start justify-between gap-3 sm:items-center">
              <div>
                <h2 className="text-xl font-extrabold uppercase text-white sm:text-2xl">Clientes</h2>
                <p className="text-sm text-slate-400">Gestiona rutinas, dietas y progreso</p>
              </div>
              <button onClick={() => setShowNewClient(true)} className="neon-button shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] sm:text-sm sm:tracking-[0.18em]">
                <Plus size={16} /> Nuevo Cliente
              </button>
            </div>

            {showNewClient && (
              <NewClientForm
                onCreated={async () => { setShowNewClient(false); await loadClients(); await loadPaymentStatuses(); }}
                onCancel={() => setShowNewClient(false)}
              />
            )}

            <div className="grid gap-3 mt-4">
              {clients.map(client => {
                const status = paymentStatuses.find(p => p.id === client.id);
                const s = status ? STATUS_STYLE[status.status] : null;
                const isInactive = status ? !status.isActive : false;
                return (
                  <button key={client.id} onClick={() => openClient(client)} className={`group neon-panel-soft flex items-center gap-4 rounded-[1.5rem] border p-5 text-left transition-all hover:border-cyan-400/32 ${isInactive ? "opacity-60" : ""}`}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-slate-300 transition-colors group-hover:bg-cyan-400/12 group-hover:text-cyan-100">
                      <User size={22} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{client.name}</p>
                      <p className="text-xs text-slate-400">@{client.username} · ${client.monthlyFee}/{PERIODICITY_OPTIONS.find(p => p.days === client.periodicityDays)?.label.toLowerCase() ?? "mes"}</p>
                    </div>
                    {isInactive && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">Inactivo</span>}
                    {!isInactive && s && <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>}
                    <ChevronRight className="text-slate-500 group-hover:text-cyan-200" />
                  </button>
                );
              })}
              {clients.length === 0 && !showNewClient && <p className="py-12 text-center text-slate-400">No hay clientes aún. ¡Agrega el primero!</p>}
            </div>
          </div>
        )}

        {/* ============ PAGOS ============ */}
        {!selectedClient && mainView === "pagos" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-extrabold uppercase text-white sm:text-2xl">Pagos</h2>
              <p className="text-sm text-slate-400">Controla vencimientos y registra pagos</p>
            </div>

            <div className="space-y-3">
              {[...paymentStatuses].sort((a, b) => (a.paidUntil ?? "").localeCompare(b.paidUntil ?? "")).map(c => {
                const s = STATUS_STYLE[c.status];
                const diff = c.paidUntil ? daysBetween(todayISO(), c.paidUntil) : null;
                return (
                  <div key={c.id} className="neon-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 p-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      <div>
                        <p className="font-bold text-white">{c.name}</p>
                        <p className="text-xs text-slate-400">
                          ${c.monthlyFee} · {PERIODICITY_OPTIONS.find(p => p.days === c.periodicityDays)?.label ?? "Mensual"}
                          {c.paidUntil && <span> · Vence {fmtDate(c.paidUntil)}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
                        {s.label}
                        {diff !== null && (diff < 0 ? ` · hace ${Math.abs(diff)}d` : diff <= 5 ? ` · en ${diff}d` : "")}
                      </span>
                      <button onClick={() => setPayingClient(c)} className="neon-button px-4 py-2 text-sm font-bold uppercase tracking-[0.16em]">
                        Registrar pago
                      </button>
                    </div>
                  </div>
                );
              })}
              {paymentStatuses.length === 0 && <p className="py-12 text-center text-slate-400">No hay clientes aún.</p>}
            </div>

            {payingClient && (
              <PaymentModal
                client={payingClient}
                onSave={registerPayment}
                onCancel={() => setPayingClient(null)}
              />
            )}
          </div>
        )}

        {!selectedClient && mainView === "plantillas" && (
          <div>
            <div className="mb-6 flex items-start justify-between gap-3 sm:items-center">
              <div>
                <h2 className="text-xl font-extrabold uppercase text-white sm:text-2xl">Plantillas</h2>
                <p className="text-sm text-slate-400">Reutiliza rutinas y dietas para acelerar altas de clientes.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                  {templates.length} guardadas
                </div>
                <button onClick={() => setShowCreateTemplateModal(true)} className="neon-button px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]">
                  Nueva plantilla
                </button>
              </div>
            </div>

            {templates.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-white/14 bg-white/4 py-16 text-center text-slate-400">
                <p className="mb-3 text-4xl">📚</p>
                <p className="font-medium text-white">Aún no hay plantillas</p>
                <p className="mt-1 text-sm text-slate-400">Abre un cliente, prepara su rutina y usa “Guardar plantilla”.</p>
                <button onClick={() => setShowCreateTemplateModal(true)} className="neon-button mx-auto mt-5 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]">
                  Crear primera plantilla
                </button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {templates.map((template) => {
                  const trainingCount = template.trainingDays.filter(day => day.exercises.length > 0).length;
                  const exerciseCount = template.trainingDays.reduce((sum, day) => sum + day.exercises.length, 0);
                  return (
                    <div key={template.id} className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200/70">Plantilla</p>
                          <h3 className="mt-2 text-lg font-extrabold text-white">{template.name}</h3>
                          <p className="mt-1 text-sm text-slate-400">{template.description?.trim() || "Sin descripción"}</p>
                        </div>
                        <button onClick={() => deleteTemplate(template.id)} className="rounded-xl border border-rose-400/16 bg-rose-400/8 p-2 text-rose-200 transition-colors hover:bg-rose-400/14">
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Días</p>
                          <p className="mt-2 text-2xl font-extrabold text-white">{trainingCount}</p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Ejercicios</p>
                          <p className="mt-2 text-2xl font-extrabold text-white">{exerciseCount}</p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Comidas</p>
                          <p className="mt-2 text-2xl font-extrabold text-white">{template.meals.length}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button onClick={() => setPreviewTemplate(template)} className="neon-button-secondary flex-1 px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">
                          Previsualizar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============ CLIENT DETAIL ============ */}
        {selectedClient && (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3 sm:items-center">
              <button onClick={() => { setSelectedClient(null); setProgress(null); }} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
                <ArrowLeft size={18} /> Volver a Clientes
              </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowTemplateModal(true)} className="neon-button-secondary px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">
                    Guardar plantilla
                  </button>
                  <div className="min-w-0 text-right">
                    <h2 className="font-bold text-white">{selectedClient.name}</h2>
                    <p className="text-xs text-slate-400">@{selectedClient.username}</p>
                  </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
            ) : (
              <>
                <div className="mb-6 flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur sm:inline-flex sm:w-fit">
                  {([
                    { id: "training", label: "Entrenamiento" },
                    { id: "diet", label: "Dieta" },
                    { id: "progress", label: "Progreso" },
                    { id: "info", label: "Info y Pago" },
                  ] as { id: ClientTab; label: string }[]).map(t => (
                    <button key={t.id} onClick={() => setClientTab(t.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-all sm:text-sm sm:tracking-[0.12em] ${clientTab === t.id ? "bg-cyan-400/16 text-white shadow-[0_0_24px_rgba(49,231,255,0.18)]" : "text-slate-400 hover:text-slate-100"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* TRAINING */}
                {clientTab === "training" && (
                  <>
                    <div className="neon-panel-soft mb-6 rounded-[1.8rem] border border-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Programación semanal</p>
                          <h3 className="mt-1 text-lg font-extrabold text-white sm:text-xl">Entrenamiento del cliente</h3>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                          {trainingDays.filter(day => day.exercises.length > 0).length} días activos
                        </div>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                      {DAYS.map(day => {
                        const trainingDay = trainingDays.find(d => d.dayName === day);
                        const hasTr = trainingDay && trainingDay.exercises.length > 0;
                        return (
                          <button key={day} onClick={() => setSelectedDay(day)} className={`flex shrink-0 flex-col items-center rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${selectedDay === day ? "border-cyan-400/40 bg-cyan-400/16 text-white shadow-[0_0_24px_rgba(49,231,255,0.18)]" : hasTr ? "border-white/12 bg-white/5 text-slate-200 hover:border-cyan-400/30" : "border-white/10 bg-white/4 text-slate-500"}`}>
                            <span>{day.slice(0, 3)}</span>
                            {trainingDay?.displayName && <span className={`text-xs font-normal ${selectedDay === day ? "text-slate-100" : "text-slate-400"}`}>{trainingDay.displayName.slice(0, 12)}</span>}
                            {hasTr && selectedDay !== day && <span className="ml-1 mt-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 align-middle" />}
                          </button>
                        );
                      })}
                    </div>
                    </div>

                    <div className="space-y-4 pb-24">
                      <div className="neon-panel sticky top-24 z-10 mb-4 flex flex-col gap-3 rounded-[1.6rem] border border-white/10 px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Ejercicios — {selectedDay}</p>
                          <input 
                            type="text" 
                            placeholder="Ej: Tren Superior, Pierna..." 
                            value={currentTraining?.displayName || ""} 
                            onChange={e => updateTrainingDayDisplayName(e.target.value)} 
                            className="w-full bg-transparent text-lg font-extrabold text-white outline-none placeholder:text-slate-500 focus:text-white"
                          />
                          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Usa el botón flotante para agregar ejercicios sin perderlo al hacer scroll.</p>
                        </div>
                      </div>

                      {(!currentTraining || currentTraining.exercises.length === 0) && (
                        <div className="rounded-[1.8rem] border border-dashed border-white/14 bg-white/4 py-16 text-center text-slate-400">
                          <p className="text-4xl mb-3">🏋️</p>
                          <p className="font-medium">Sin ejercicios para {selectedDay}</p>
                        </div>
                      )}

                      {currentExerciseGroups.map((group, groupIdx) => {
                        const isCombo = group.size > 1;
                        const isBiserie = group.size === 2;
                        const isTriserie = group.size === 3;
                        const comboTheme = isBiserie
                          ? {
                              container: "border-orange-300/28 bg-[linear-gradient(180deg,rgba(255,149,0,0.12),rgba(10,16,32,0.8))]",
                              header: "border-orange-300/18 bg-orange-300/10",
                              badge: "bg-orange-300/16 text-orange-100",
                              title: "text-orange-100/90",
                              pill: "border-orange-300/24 bg-orange-300/12 text-orange-100",
                              exerciseCard: "border-orange-300/16 bg-[#1a140b]",
                              exerciseLabel: "text-orange-100/80",
                              addSet: "border-orange-300/20 text-orange-100/90 hover:border-orange-300/34",
                            }
                          : isTriserie
                            ? {
                              container: "border-rose-400/28 bg-[linear-gradient(180deg,rgba(255,58,58,0.14),rgba(10,16,32,0.8))]",
                              header: "border-rose-400/18 bg-rose-400/10",
                              badge: "bg-rose-400/16 text-rose-100",
                              title: "text-rose-100/90",
                              pill: "border-rose-300/24 bg-rose-300/12 text-rose-100",
                              exerciseCard: "border-rose-300/16 bg-[#1b0b11]",
                              exerciseLabel: "text-rose-100/80",
                              addSet: "border-rose-300/20 text-rose-100/90 hover:border-rose-300/34",
                            }
                            : {
                              container: "border-amber-300/30 bg-[linear-gradient(180deg,rgba(255,214,10,0.16),rgba(10,16,32,0.82))]",
                              header: "border-amber-300/22 bg-amber-300/10",
                              badge: "bg-amber-300/18 text-amber-100",
                              title: "text-amber-100/90",
                              pill: "border-amber-300/26 bg-amber-300/12 text-amber-100",
                              exerciseCard: "border-amber-300/18 bg-[#1a1808]",
                              exerciseLabel: "text-amber-100/80",
                              addSet: "border-amber-300/24 text-amber-100/90 hover:border-amber-300/40",
                            };
                        return (
                          <div key={group.key} className={`overflow-hidden rounded-[1.8rem] border shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur ${isCombo ? comboTheme.container : "border-white/10 bg-[rgba(10,16,32,0.78)]"}`}>
                            <div className={`flex items-start gap-3 border-b px-4 py-4 sm:px-5 ${isCombo ? comboTheme.header : "border-white/8 bg-white/4"}`}>
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${isCombo ? comboTheme.badge : "bg-cyan-400/14 text-cyan-100"}`}>{groupIdx + 1}</span>
                              <div className="flex-1 space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isCombo ? comboTheme.title : "text-cyan-200/70"}`}>{getSessionLabel(group.size)}</p>
                                    <p className="text-xs text-slate-500">{group.size === 1 ? "Ejercicio individual" : `${group.size} ejercicios agrupados visualmente para identificar el bloque`}</p>
                                  </div>
                                  {isCombo ? (
                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${comboTheme.pill}`}>
                                      {`${getSessionLabel(group.size)} X${group.size}`}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="space-y-3">
                                  {group.exercises.map((exercise, exerciseIdx) => (
                                    <div key={exercise.id} className={`rounded-xl border p-3 ${isCombo ? comboTheme.exerciseCard : "border-white/8 bg-[#091120]"}`}>
                                      <div className="flex items-start gap-3">
                                        <div className={`pt-2 text-[10px] font-bold uppercase tracking-[0.14em] ${isCombo ? comboTheme.exerciseLabel : "text-slate-500"}`}>
                                          {group.size === 1 ? "Ejercicio" : `Ejercicio ${exerciseIdx + 1}`}
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex-1">
                                              <input type="text" placeholder="Nombre del ejercicio" value={exercise.name} onChange={e => updateExerciseName(exercise.id, e.target.value)} className="w-full bg-transparent text-base font-bold text-white outline-none placeholder:text-slate-500" />
                                              <input type="text" placeholder="Nota opcional..." value={exercise.notes || ""} onChange={e => updateExerciseNotes(exercise.id, e.target.value)} className="mt-1 w-full bg-transparent text-xs text-slate-400 outline-none placeholder:text-slate-600" />
                                            </div>
                                            <select value={exercise.type || "reps"} onChange={e => updateExerciseType(exercise.id, e.target.value as "reps" | "time")} className="rounded-lg border border-white/10 bg-white/6 px-2 py-1.5 text-xs text-slate-200 outline-none hover:border-cyan-400/30">
                                              <option value="reps">Repeticiones</option>
                                              <option value="time">Tiempo (min)</option>
                                            </select>
                                          </div>
                                        </div>
                                        <button onClick={() => removeExercise(exercise.id)} className="pt-2 text-slate-500 transition-colors hover:text-rose-300"><Trash2 size={18} /></button>
                                      </div>

                                      <div className="mt-3 space-y-2">
                                        {exercise.sets.map((s, sIdx) => (
                                          <div key={sIdx} className="grid grid-cols-12 items-center gap-2 rounded-xl bg-white/4 p-2">
                                            <span className="col-span-2 rounded-lg bg-[#091120] py-2 text-center text-sm font-mono text-slate-400">#{sIdx + 1}</span>
                                            <input type="text" placeholder={exercise.type === "time" ? "ej. 30" : "ej. 12"} value={s.reps} onChange={e => updateSetReps(exercise.id, sIdx, e.target.value)} className="col-span-7 rounded-xl border border-white/10 bg-[#091120] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/12" />
                                            <button onClick={() => removeSet(exercise.id, sIdx)} className="col-span-3 flex justify-center text-slate-500 transition-colors hover:text-rose-300"><Trash2 size={15} /></button>
                                          </div>
                                        ))}
                                        <button onClick={() => addSet(exercise.id)} className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-sm font-medium transition-colors ${isCombo ? comboTheme.addSet : "border-white/14 text-slate-400 hover:border-cyan-400/30 hover:text-cyan-100"}`}>
                                          <Plus size={15} /> Agregar serie a este ejercicio
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3 sm:right-6">
                      {showExerciseMenu && (
                        <div className="flex flex-col gap-2">
                          <div className="flex min-w-[184px] items-center gap-2 rounded-xl border border-white/10 bg-[#081120]/95 p-2">
                            <input
                              type="number"
                              min={4}
                              step={1}
                              value={superserieCount}
                              onChange={(e) => setSuperserieCount(e.target.value)}
                              className="w-16 rounded-lg border border-white/12 bg-white/6 px-2 py-1 text-center text-sm font-bold text-white outline-none focus:border-cyan-400/40"
                            />
                            <button onClick={addSuperserieGroup} className="neon-button-secondary flex-1 justify-center px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]">Superserie</button>
                          </div>
                          <button onClick={() => addExerciseGroup(3)} className="neon-button-secondary min-w-[184px] justify-center px-4 py-2 text-xs font-bold uppercase tracking-[0.14em]">Triserie</button>
                          <button onClick={() => addExerciseGroup(2)} className="neon-button-secondary min-w-[184px] justify-center px-4 py-2 text-xs font-bold uppercase tracking-[0.14em]">Biserie</button>
                          <button onClick={() => addExerciseGroup(1)} className="neon-button-secondary min-w-[184px] justify-center px-4 py-2 text-xs font-bold uppercase tracking-[0.14em]">1 ejercicio</button>
                        </div>
                      )}

                      <button
                        onClick={() => setShowExerciseMenu(prev => !prev)}
                        className="neon-button flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                      >
                        <Plus size={18} className={showExerciseMenu ? "rotate-45 transition-transform" : "transition-transform"} />
                        {showExerciseMenu ? "Cerrar" : "Ejercicio"}
                      </button>
                    </div>
                  </>
                )}

                {/* DIET */}
                {clientTab === "diet" && (
                  <div className="space-y-4">
                    <div className="neon-panel sticky top-24 z-10 mb-4 flex items-center justify-between rounded-[1.6rem] border border-white/10 px-6 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div>
                        <h3 className="text-lg font-extrabold text-white">Plan de Alimentación</h3>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Dieta general · Aplica todos los días</p>
                      </div>
                      <button onClick={addMeal} className="neon-button flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">
                        <Plus size={16} /> Comida
                      </button>
                    </div>
                    {(!diet || diet.meals.length === 0) && (
                      <div className="rounded-[1.8rem] border border-dashed border-white/14 bg-white/4 py-16 text-center text-slate-400"><p className="mb-3 text-4xl">🥗</p><p className="font-medium">Sin comidas asignadas</p></div>
                    )}
                    {diet?.meals.map((meal, idx) => (
                      <div key={meal.id} className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[rgba(10,16,32,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur">
                        <div className="flex items-center gap-3 border-b border-white/8 bg-white/4 px-5 py-4">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-300/14 text-xs font-bold text-lime-100">{idx + 1}</span>
                          <input type="time" value={meal.time} onChange={e => updateMeal(meal.id, "time", e.target.value)} className="bg-transparent font-semibold text-white outline-none" />
                          <div className="flex-1" />
                          <button onClick={() => removeMeal(meal.id)} className="text-slate-500 transition-colors hover:text-rose-300"><Trash2 size={18} /></button>
                        </div>
                        <div className="p-5">
                          <textarea placeholder="Descripción..." value={meal.description} onChange={e => updateMeal(meal.id, "description", e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-[#091120] p-3 text-sm text-slate-100 outline-none focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/12" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PROGRESS */}
                {clientTab === "progress" && progress && (
                  <div className="space-y-6">
                    <section className="neon-panel-soft rounded-[1.8rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-2"><Activity size={18} className="text-cyan-200" /><h3 className="font-bold text-white">Adherencia semanal</h3></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setWeekStart(addDaysDate(weekStart, -7))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/8 hover:text-white"><ChevronLeft size={16} /></button>
                          <span className="px-3 text-xs font-bold text-slate-300">{fmtShort(weekStart)} – {fmtShort(addDaysDate(weekStart, 6))}</span>
                          <button onClick={() => setWeekStart(addDaysDate(weekStart, 7))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/8 hover:text-white"><ChevronRight size={16} /></button>
                        </div>
                      </div>
                      <WeekCalendar weekStart={weekStart} logs={progress.logs} trainingDays={trainingDays} />
                    </section>

                    <section className="neon-panel-soft rounded-[1.8rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><TrendingDown size={18} className="text-lime-200" /><div><h3 className="font-bold text-white">Peso y medidas</h3><p className="text-xs text-slate-400">Registros del cliente</p></div></div>
                        <button onClick={() => setShowAddBody(true)} className="neon-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]"><Plus size={14} /> Nuevo</button>
                      </div>
                      {progress.bodyProgress.length > 0 && (
                        <div className="mb-5 space-y-5">
                          <ProgressChart data={progress.bodyProgress.filter(b => b.weight).map(b => ({ date: b.recordDate, value: Number(b.weight) })).reverse()} label="Evolución Peso" unit="kg" color="#0f172a" />
                          {progress.bodyProgress.some(b => b.waist) && (
                            <ProgressChart data={progress.bodyProgress.filter(b => b.waist).map(b => ({ date: b.recordDate, value: Number(b.waist) })).reverse()} label="Cintura" unit="cm" color="#16a34a" />
                          )}
                        </div>
                      )}
                      {progress.bodyProgress.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">Sin registros aún</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {progress.bodyProgress.slice(0, 12).map(b => (
                            <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
                              <div>
                                <p className="font-bold text-white">{fmtDate(b.recordDate)}</p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {b.weight && <span className="font-semibold">{b.weight} kg</span>}
                                  {b.waist && <span> · Cintura {b.waist}cm</span>}
                                  {b.hip && <span> · Cadera {b.hip}cm</span>}
                                  {b.arm && <span> · Brazo {b.arm}cm</span>}
                                  {b.thigh && <span> · Muslo {b.thigh}cm</span>}
                                </p>
                              </div>
                              <button onClick={() => deleteBody(b.id)} className="text-slate-500 hover:text-rose-300"><Trash2 size={15} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      {showAddBody && <BodyForm onSave={saveBodyProgress} onCancel={() => setShowAddBody(false)} />}
                    </section>

                    <section className="neon-panel-soft rounded-[1.8rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><Activity size={18} className="text-fuchsia-200" /><div><h3 className="font-bold text-white">InBody / Composición corporal</h3><p className="text-xs text-slate-400">Métricas mensuales</p></div></div>
                        <button onClick={() => setShowAddInBody(true)} className="neon-button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]"><Plus size={14} /> Nuevo</button>
                      </div>
                      {progress.inbody.length > 0 && (
                        <div className="mb-5 space-y-5">
                          <ProgressChart data={progress.inbody.filter(i => i.bodyFatPercent).map(i => ({ date: i.recordDate, value: Number(i.bodyFatPercent) })).reverse()} label="Grasa Corporal" unit="%" color="#ef4444" />
                          <ProgressChart data={progress.inbody.filter(i => i.muscleMass).map(i => ({ date: i.recordDate, value: Number(i.muscleMass) })).reverse()} label="Masa Muscular" unit="kg" color="#16a34a" />
                        </div>
                      )}
                      {progress.inbody.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">Sin registros aún</p>
                      ) : (
                        <div className="space-y-3">
                          {progress.inbody.map(ib => <InBodyCard key={ib.id} record={ib} onDelete={() => deleteInBody(ib.id)} />)}
                        </div>
                      )}
                      {showAddInBody && <InBodyForm onSave={saveInBody} onCancel={() => setShowAddInBody(false)} />}
                    </section>
                  </div>
                )}
                {clientTab === "progress" && !progress && (
                  <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" size={32} /></div>
                )}

                {/* INFO Y PAGO */}
                {clientTab === "info" && (
                  <ClientInfoTab
                    client={selectedClient}
                    paymentStatus={paymentStatuses.find(p => p.id === selectedClient.id) ?? null}
                    onUpdated={async (updated) => {
                      setSelectedClient(prev => prev ? { ...prev, ...updated } : prev);
                      await loadClients();
                      await loadPaymentStatuses();
                    }}
                    onRegisterPayment={async (amount, date) => {
                      await registerPayment(selectedClient.id, amount, date);
                    }}
                    onToggleActive={async (id, nextActive) => {
                      await fetch(`/api/clients/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: nextActive }),
                      });
                      await loadClients();
                      await loadPaymentStatuses();
                      setSelectedClient(null);
                    }}
                    onDelete={async (id) => {
                      await fetch(`/api/clients/${id}`, { method: "DELETE" });
                      await loadClients();
                      await loadPaymentStatuses();
                      setSelectedClient(null);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showTemplateModal && selectedClient && (
        <SaveTemplateModal
          trainingDays={trainingDays}
          dietMeals={diet?.meals ?? []}
          clientName={selectedClient.name}
          onCancel={() => setShowTemplateModal(false)}
          onSaved={async () => {
            setShowTemplateModal(false);
            await loadTemplates();
          }}
        />
      )}

      {showCreateTemplateModal && (
        <CreateTemplateModal
          clients={clients}
          onCancel={() => setShowCreateTemplateModal(false)}
          onCreated={async () => {
            setShowCreateTemplateModal(false);
            await loadTemplates();
          }}
        />
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onDelete={async () => {
            await deleteTemplate(previewTemplate.id);
          }}
        />
      )}
    </main>
  );
}

function CreateTemplateModal({
  clients,
  onCancel,
  onCreated,
}: {
  clients: Client[];
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceClientId, setSourceClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Ponle un nombre a la plantilla");
      return;
    }

    setSaving(true);
    try {
      let trainingDays: TemplateTrainingDay[] = [];
      let meals: Meal[] = [];

      if (sourceClientId) {
        const [trainingRes, dietRes] = await Promise.all([
          fetch(`/api/training-days?clientId=${sourceClientId}`),
          fetch(`/api/diet?clientId=${sourceClientId}`),
        ]);

        if (!trainingRes.ok || !dietRes.ok) {
          throw new Error("No se pudieron cargar los datos del cliente origen");
        }

        const trainingData: unknown = await trainingRes.json();
        const dietData: unknown = await dietRes.json();

        trainingDays = Array.isArray(trainingData)
          ? (trainingData as TrainingDay[]).map((day) => ({
              dayName: day.dayName,
              displayName: day.displayName,
              exercises: day.exercises,
            }))
          : [];

        meals = dietData && typeof dietData === "object" && Array.isArray((dietData as Diet).meals)
          ? (dietData as Diet).meals
          : [];
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, trainingDays, meals }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo crear la plantilla");
      }

      await onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear la plantilla");
      setSaving(false);
      return;
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/82 p-4 backdrop-blur-sm">
      <div className="neon-panel w-full max-w-lg rounded-[1.8rem] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl font-extrabold uppercase text-white">Nueva plantilla</h3>
        <p className="mt-2 text-sm text-slate-400">Puedes crearla vacía o copiar la rutina y dieta de un cliente existente.</p>

        <div className="mt-5 space-y-4">
          <div className="neon-field">
            <label className="neon-label">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="neon-input" placeholder="Ej. Hipertrofia tren superior" />
          </div>

          <div className="neon-field">
            <label className="neon-label">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="neon-input resize-none" placeholder="Notas internas u objetivo de la plantilla" />
          </div>

          <div className="neon-field">
            <label className="neon-label">Copiar desde cliente (opcional)</label>
            <select value={sourceClientId} onChange={e => setSourceClientId(e.target.value)} className="neon-input">
              <option value="">Crear vacía</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={submit} disabled={saving} className="neon-button flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">
            {saving ? "Creando..." : "Crear plantilla"}
          </button>
          <button onClick={onCancel} className="neon-button-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ============ NEW CLIENT FORM ============
function NewClientForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [periodicityDays, setPeriodicityDays] = useState(30);
  const [startDate, setStartDate] = useState(todayISO());
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) return;
      const data: unknown = await res.json();
      setTemplates(Array.isArray(data) ? data as WorkoutTemplate[] : []);
    })();
  }, []);

  const submit = async () => {
    setError("");
    if (!name || !username || !password) {
      setError("Nombre, usuario y contraseña son obligatorios");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, monthlyFee: monthlyFee || 0, periodicityDays, startDate, templateId: templateId ? Number(templateId) : undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al crear cliente");
      return;
    }
    onCreated();
  };

  return (
    <div className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <h3 className="mb-4 text-lg font-extrabold uppercase text-white">Agregar Cliente</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="neon-label">Nombre completo *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="neon-input" />
        </div>
        <div>
          <label className="neon-label">Usuario *</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="ej. juan.perez" className="neon-input" />
        </div>
        <div>
          <label className="neon-label">Contraseña *</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña para el cliente" className="neon-input" />
        </div>
        <div>
          <label className="neon-label">Monto a cobrar ($)</label>
          <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder="800" className="neon-input" />
        </div>
        <div>
          <label className="neon-label">Periodicidad</label>
          <select value={periodicityDays} onChange={e => setPeriodicityDays(Number(e.target.value))} className="neon-input">
            {PERIODICITY_OPTIONS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="neon-label">Fecha de inicio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="neon-input" />
        </div>
        <div className="md:col-span-2">
          <label className="neon-label">Plantilla base (opcional)</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="neon-input">
            <option value="">Sin plantilla</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={submit} disabled={saving} className="neon-button px-4 py-2 text-sm font-bold uppercase tracking-[0.16em] disabled:opacity-50">
          {saving ? "Creando..." : "Crear Cliente"}
        </button>
        <button onClick={onCancel} className="neon-button-secondary px-4 py-2 text-sm font-bold uppercase tracking-[0.16em]">Cancelar</button>
      </div>
    </div>
  );
}

function SaveTemplateModal({
  trainingDays,
  dietMeals,
  clientName,
  onCancel,
  onSaved,
}: {
  trainingDays: TrainingDay[];
  dietMeals: Meal[];
  clientName: string;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(`Plantilla ${clientName}`);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Ponle un nombre a la plantilla");
      return;
    }

    setSaving(true);
    const payload = {
      name,
      description,
      trainingDays: trainingDays.map(day => ({
        dayName: day.dayName,
        displayName: day.displayName,
        exercises: day.exercises,
      })),
      meals: dietMeals,
    };

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo guardar la plantilla");
      return;
    }

    await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/82 p-4 backdrop-blur-sm">
      <div className="neon-panel w-full max-w-lg rounded-[1.8rem] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl font-extrabold uppercase text-white">Guardar como plantilla</h3>
        <p className="mt-2 text-sm text-slate-400">Guarda la rutina y la dieta actuales para reutilizarlas con nuevos clientes.</p>

        <div className="mt-5 space-y-4">
          <div className="neon-field">
            <label className="neon-label">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="neon-input" />
          </div>
          <div className="neon-field">
            <label className="neon-label">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="neon-input resize-none" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-slate-300">
            <p>Se guardarán:</p>
            <p className="mt-2 text-slate-400">{trainingDays.filter(day => day.exercises.length > 0).length} días de entrenamiento y {dietMeals.length} comidas.</p>
          </div>
          {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={submit} disabled={saving} className="neon-button flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">
            {saving ? "Guardando..." : "Guardar plantilla"}
          </button>
          <button onClick={onCancel} className="neon-button-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  template,
  onClose,
  onDelete,
}: {
  template: WorkoutTemplate;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/82 p-2 backdrop-blur-sm sm:p-4">
      <div className="neon-panel flex max-h-[calc(100vh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] shadow-[0_28px_70px_rgba(0,0,0,0.5)] sm:max-h-[calc(100vh-2rem)]">
        <div className="border-b border-white/8 px-4 py-4 sm:px-6">
          <div className="mb-4 flex justify-end">
            <button onClick={onClose} className="neon-button-secondary px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Cerrar</button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Previsualización</p>
              <h3 className="mt-2 text-xl font-extrabold text-white sm:text-2xl">{template.name}</h3>
              <p className="mt-2 text-sm text-slate-400">{template.description?.trim() || "Sin descripción"}</p>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button onClick={handleDelete} disabled={deleting} className="w-full rounded-xl border border-rose-400/18 bg-rose-400/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-rose-200 hover:bg-rose-400/14 disabled:opacity-60 sm:w-auto">
                {deleting ? "Borrando..." : "Borrar"}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">Rutina</h4>
            <div className="space-y-3">
              {template.trainingDays.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/14 bg-white/4 p-6 text-sm text-slate-400">Sin días de entrenamiento.</div>
              )}
              {template.trainingDays.map((day) => (
                <div key={day.dayName} className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{day.dayName}</p>
                      <p className="text-xs text-slate-500">{day.displayName || "Sin título"}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">{day.exercises.length} ejercicios</span>
                  </div>
                  {day.exercises.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {groupExercisesBySession(day.exercises).map((group) => (
                        <div key={group.key} className="rounded-xl border border-white/8 bg-[#091120] p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/70">{getSessionLabel(group.size)}</p>
                          <div className="mt-2 space-y-1">
                            {group.exercises.map((exercise) => (
                              <p key={exercise.id} className="text-sm text-slate-200">{exercise.name || "Ejercicio sin nombre"}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </section>

            <section className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">Dieta</h4>
            <div className="space-y-3">
              {template.meals.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/14 bg-white/4 p-6 text-sm text-slate-400">Sin comidas en la plantilla.</div>
              )}
              {template.meals.map((meal, idx) => (
                <div key={meal.id} className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-300/14 text-xs font-bold text-lime-100">{idx + 1}</span>
                    <p className="font-bold text-white">{meal.time}</p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{meal.description || "Sin descripción"}</p>
                </div>
              ))}
            </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PAYMENT MODAL ============
function PaymentModal({ client, onSave, onCancel }: {
  client: PaymentStatusRow;
  onSave: (clientId: number, amount: string, paymentDate: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(client.monthlyFee);
  const [paymentDate, setPaymentDate] = useState(todayISO());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 p-4 backdrop-blur-sm">
      <div className="neon-panel w-full max-w-sm rounded-[1.8rem] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
        <h3 className="mb-1 text-xl font-extrabold uppercase text-white">Registrar pago</h3>
        <p className="mb-4 text-sm text-slate-400">{client.name}</p>
        <div className="space-y-3">
          <div><label className="neon-label">Monto</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="neon-input" /></div>
          <div><label className="neon-label">Fecha de pago</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="neon-input" /></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => onSave(client.id, amount, paymentDate)} className="neon-button flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">Confirmar pago y activar</button>
          <button onClick={onCancel} className="neon-button-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ============ CLIENT INFO TAB ============
function ClientInfoTab({ client, paymentStatus, onUpdated, onRegisterPayment, onToggleActive, onDelete }: {
  client: Client;
  paymentStatus: PaymentStatusRow | null;
  onUpdated: (data: Partial<Client>) => void;
  onRegisterPayment: (amount: string, date: string) => void;
  onToggleActive: (id: number, nextActive: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [monthlyFee, setMonthlyFee] = useState(client.monthlyFee);
  const [periodicityDays, setPeriodicityDays] = useState(client.periodicityDays);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const isActive = paymentStatus ? paymentStatus.isActive : true;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyFee, periodicityDays, newPassword: newPassword || undefined }),
    });
    setSaving(false);
    setSaved(true);
    setNewPassword("");
    onUpdated({ monthlyFee: String(monthlyFee), periodicityDays });
    setTimeout(() => setSaved(false), 2000);
  };

  const confirmToggleActive = () => {
    onToggleActive(client.id, !isActive);
    setShowDeactivateConfirm(false);
  };

  const deleteClient = () => {
    onDelete(client.id);
    setShowDeleteConfirm(false);
  };

  const s = paymentStatus ? STATUS_STYLE[paymentStatus.status] : null;

  return (
    <div className="space-y-6 max-w-xl">
      <section className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-white"><KeyRound size={16} /> Credenciales de acceso</h3>
        <div className="space-y-3">
          <div>
            <label className="neon-label">Usuario (compártelo con el cliente)</label>
            <div className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm font-mono text-slate-100">{client.username}</div>
          </div>
          <div>
            <label className="neon-label">Nueva contraseña (dejar vacío para no cambiar)</label>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña" className="neon-input" />
          </div>
        </div>
      </section>

      <section className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <h3 className="mb-4 font-bold text-white">Cobro y periodicidad</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="neon-label">Monto ($)</label>
            <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="neon-input" />
          </div>
          <div>
            <label className="neon-label">Periodicidad</label>
            <select value={periodicityDays} onChange={e => setPeriodicityDays(Number(e.target.value))} className="neon-input">
              {PERIODICITY_OPTIONS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={save} disabled={saving} className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] transition-all ${saved ? "bg-green-600 text-white" : "neon-button"}`}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar cambios"}
        </button>
      </section>

      {paymentStatus && (
        <section className="neon-panel-soft rounded-[1.6rem] border border-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-white"><CreditCard size={16} /> Estado de pago</h3>
          <div className="flex items-center justify-between mb-4">
            {s && <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>}
            <span className="text-sm text-slate-400">{paymentStatus.paidUntil ? `Vence: ${fmtDate(paymentStatus.paidUntil)}` : "Sin pagos registrados"}</span>
          </div>
          <button onClick={() => setShowPayModal(true)} className="neon-button w-full px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em]">
            Registrar pago y activar
          </button>
        </section>
      )}

      {/* Acciones de cliente (activar/desactivar y eliminar) */}
      <section className="rounded-[1.6rem] border border-rose-400/16 bg-[rgba(30,8,18,0.62)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur">
        <h3 className="mb-4 font-bold text-rose-200">Acciones peligrosas</h3>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/6 bg-white/4 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Estado de la cuenta</p>
            <p className="text-xs text-slate-400">{isActive ? "El cliente puede iniciar sesión" : "El cliente no puede acceder a la app"}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isActive ? "bg-green-50 text-green-700" : "bg-slate-200 text-slate-600"}`}>
            {isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeactivateConfirm(true)}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${isActive ? "border-rose-300/30 text-rose-200 hover:bg-rose-400/10" : "border-green-300/30 text-green-200 hover:bg-green-400/10"}`}
          >
            {isActive ? "Desactivar cliente" : "Activar cliente"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 rounded-xl border border-rose-500/40 py-3 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-400/10"
          >
            Eliminar cliente
          </button>
        </div>

        {showDeactivateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/82 p-4 backdrop-blur-sm">
            <div className="neon-panel w-full max-w-xs rounded-2xl p-6 shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
              <p className="mb-2 font-bold text-white">
                {isActive ? "¿Desactivar este cliente?" : "¿Activar este cliente?"}
              </p>
              <p className="mb-5 text-sm text-slate-400">
                {isActive
                  ? "El cliente perderá acceso inmediato a la app (no podrá ver su rutina, dieta ni progreso) hasta que lo reactives."
                  : "El cliente podrá volver a iniciar sesión y ver su información normalmente."}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeactivateConfirm(false)} className="neon-button-secondary flex-1 py-2 text-sm font-bold uppercase tracking-[0.12em]">Cancelar</button>
                <button
                  onClick={confirmToggleActive}
                  className={`flex-1 rounded-xl py-2 text-sm font-bold uppercase tracking-[0.12em] text-white ${isActive ? "bg-rose-600 hover:bg-rose-500" : "bg-green-600 hover:bg-green-500"}`}
                >
                  {isActive ? "Sí, desactivar" : "Sí, activar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/82 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xs rounded-2xl border border-rose-400/18 bg-[rgba(32,8,16,0.88)] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.5)] backdrop-blur">
              <p className="mb-2 font-bold text-rose-200">¿Eliminar cliente permanentemente?</p>
              <p className="mb-5 text-sm text-slate-300">Se borrarán todos sus entrenamientos, dietas, logs, mediciones e InBody. Esta acción es irreversible.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="neon-button-secondary flex-1 py-2 text-sm font-bold uppercase tracking-[0.12em]">Cancelar</button>
                <button onClick={deleteClient} className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-bold uppercase tracking-[0.12em] text-white hover:bg-rose-500">Sí, eliminar</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {showPayModal && paymentStatus && (
        <PaymentModal
          client={paymentStatus}
          onSave={(_id, amount, date) => { onRegisterPayment(amount, date); setShowPayModal(false); }}
          onCancel={() => setShowPayModal(false)}
        />
      )}
    </div>
  );
}

// ============ WEEK CALENDAR ============
function WeekCalendar({ weekStart, logs, trainingDays }: { weekStart: Date; logs: LogRow[]; trainingDays: TrainingDay[] }) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysDate(weekStart, i));

  const dateToTrainingDay = (date: Date): TrainingDay | null => {
    const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
    return trainingDays.find(t => t.dayName === dayName) ?? null;
  };
  const dateToLog = (date: Date, td: TrainingDay | null): LogRow | null => {
    if (!td) return null;
    const dateStr = toISO(date);
    return logs.find(l => l.trainingDayId === td.id && l.logDate === dateStr) ?? null;
  };

  const completedCount = weekDates.filter(d => {
    const td = dateToTrainingDay(d);
    const log = dateToLog(d, td);
    return td && td.exercises.length > 0 && log?.dayCompleted;
  }).length;
  const hasRoutineCount = weekDates.filter(d => {
    const td = dateToTrainingDay(d);
    return td && td.exercises.length > 0;
  }).length;

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 mb-3">
        {weekDates.map((d, i) => {
          const td = dateToTrainingDay(d);
          const log = dateToLog(d, td);
          const hasRoutine = td && td.exercises.length > 0;
          const isCompleted = hasRoutine && log?.dayCompleted;
          const isToday = toISO(d) === toISO(new Date());
          return (
            <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${isCompleted ? "bg-lime-300/12 border-lime-300/35" : hasRoutine ? "bg-white/5 border-white/10" : "bg-white/4 border-dashed border-white/10 opacity-60"} ${isToday ? "ring-2 ring-cyan-300/60 ring-offset-1 ring-offset-[#07101f]" : ""}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isCompleted ? "text-lime-100" : hasRoutine ? "text-slate-300" : "text-slate-500"}`}>{DAY_ABBR[DAYS[i]]}</span>
              <span className={`text-xl font-black ${isCompleted ? "text-lime-100" : hasRoutine ? "text-white" : "text-slate-500"}`}>{d.getDate()}</span>
              <span className="mt-0.5">
                {isCompleted ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lime-400"><Check size={10} className="text-slate-950" /></span>
                ) : hasRoutine ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" />
                ) : (
                  <span className="text-[9px] text-slate-500">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-lime-400"></span>Días completados</span>
        <span className="font-bold text-white">{completedCount}/{hasRoutineCount} días</span>
      </div>
    </div>
  );
}

// ============ BODY FORM ============
function BodyForm({ onSave, onCancel }: { onSave: (data: Partial<BodyRow> & { recordDate: string }) => void; onCancel: () => void }) {
  const [recordDate, setRecordDate] = useState(todayISO());
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
      <div><label className="neon-label">Fecha</label><input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="neon-input" /></div>
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

// ============ INBODY FORM ============
function InBodyForm({ onSave, onCancel }: { onSave: (data: Partial<InBodyRow> & { recordDate: string }) => void; onCancel: () => void }) {
  const [recordDate, setRecordDate] = useState(todayISO());
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
      <div><label className="neon-label">Fecha</label><input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="neon-input" /></div>
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
        <button onClick={() => onSave({ recordDate, weight, bodyFatPercent, muscleMass, bmi, bodyWaterPercent, bmr, visceralFat, bodyAge: bodyAge ? Number(bodyAge) : null, notes })} className="neon-button px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Guardar</button>
        <button onClick={onCancel} className="neon-button-secondary px-4 py-2 text-sm font-bold uppercase tracking-[0.12em]">Cancelar</button>
      </div>
    </div>
  );
}

// ============ INBODY CARD ============
function InBodyCard({ record, onDelete }: { record: InBodyRow; onDelete: () => void }) {
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
      <div className="flex items-center gap-2 p-4 transition-colors hover:bg-white/6">
        <button onClick={() => setOpen(o => !o)} className="flex min-w-0 flex-1 items-center justify-between text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuchsia-300/14 text-xs font-bold text-fuchsia-100">
              {new Date(record.recordDate + "T00:00").toLocaleDateString("es-MX", { month: "short" }).toUpperCase().slice(0, 3)}
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-bold text-white">{fmtDate(record.recordDate)}</p>
              <p className="truncate text-xs text-slate-400">
                {record.weight && <span>{record.weight} kg</span>}
                {record.bodyFatPercent && <span> · {record.bodyFatPercent}% grasa</span>}
                {record.muscleMass && <span> · {record.muscleMass}kg músculo</span>}
              </p>
            </div>
          </div>
          <ChevronDown size={16} className={`ml-3 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDelete} className="p-1 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
        </div>
      </div>
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
          {record.notes && <p className="mt-3 text-sm italic text-slate-400">&quot;{record.notes}&quot;</p>}
        </div>
      )}
    </div>
  );
}
