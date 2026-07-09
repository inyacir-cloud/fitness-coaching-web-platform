"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Save, ArrowLeft, User, ChevronRight, Loader2,
  Check, ChevronLeft, ChevronDown, TrendingDown, Activity,
  LayoutDashboard, Users, CreditCard, AlertTriangle, KeyRound,
} from "lucide-react";
import type { Exercise, Meal } from "@/db/schema";
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
type TrainingDay = { id?: number; clientId: number; dayName: string; exercises: Exercise[] };
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

type MainView = "dashboard" | "clientes" | "pagos";
type ClientTab = "training" | "diet" | "progress" | "info";

const STATUS_STYLE: Record<PaymentStatus, { bg: string; text: string; label: string; dot: string }> = {
  activo: { bg: "bg-green-50", text: "text-green-700", label: "Activo", dot: "bg-green-500" },
  por_vencer: { bg: "bg-amber-50", text: "text-amber-700", label: "Por vencer", dot: "bg-amber-500" },
  vencido: { bg: "bg-red-50", text: "text-red-700", label: "Vencido", dot: "bg-red-500" },
};

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

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    setClients(await res.json());
  }, []);

  const loadPaymentStatuses = useCallback(async () => {
    const res = await fetch("/api/payments/status");
    setPaymentStatuses(await res.json());
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
    }
  }, [coachAuth, loadClients, loadPaymentStatuses]);

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
    localStorage.removeItem("emicoach-coach-session");
    await fetch("/api/auth/coach-logout", { method: "POST" });
    setCoachAuth("login");
    setCoachUser("");
    setCoachPass("");
  };

  const openClient = useCallback(async (client: Client) => {
    setLoading(true);
    const [td, dietRes] = await Promise.all([
      fetch(`/api/training-days?clientId=${client.id}`).then(r => r.json()),
      fetch(`/api/diet?clientId=${client.id}`).then(r => r.json()),
    ]);
    setTrainingDays(td);
    setDiet(dietRes ?? { clientId: client.id, meals: [] });
    setSelectedClient(client);
    setSelectedDay("Lunes");
    setClientTab("training");
    setWeekStart(getMonday(new Date()));
    setProgress(null);
    setLoading(false);
  }, []);

  const loadProgress = useCallback(async (clientId: number) => {
    const res = await fetch(`/api/client-progress?clientId=${clientId}`);
    setProgress(await res.json());
  }, []);

  useEffect(() => {
    if (clientTab === "progress" && selectedClient) loadProgress(selectedClient.id);
  }, [clientTab, selectedClient, loadProgress]);

  // --- Training helpers ---
  const currentTraining = trainingDays.find(d => d.dayName === selectedDay);
  const updateTraining = (updater: (day: TrainingDay) => TrainingDay) => {
    setTrainingDays(prev => {
      const exists = prev.find(d => d.dayName === selectedDay);
      if (exists) return prev.map(d => d.dayName === selectedDay ? updater(d) : d);
      const fresh: TrainingDay = { clientId: selectedClient!.id, dayName: selectedDay, exercises: [] };
      return [...prev, updater(fresh)];
    });
  };
  const addExercise = () => updateTraining(day => ({ ...day, exercises: [...day.exercises, { id: crypto.randomUUID(), name: "", sets: [{ reps: "12" }] }] }));
  const updateExerciseName = (exId: string, name: string) => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, name } : ex) }));
  const addSet = (exId: string) => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, sets: [...ex.sets, { reps: "12" }] } : ex) }));
  const removeSet = (exId: string, setIdx: number) => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) } : ex) }));
  const updateSetReps = (exId: string, setIdx: number, reps: string) => updateTraining(day => ({ ...day, exercises: day.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map((s, i) => i === setIdx ? { reps } : s) } : ex) }));
  const removeExercise = (exId: string) => updateTraining(day => ({ ...day, exercises: day.exercises.filter(ex => ex.id !== exId) }));

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
          ops.push(fetch(`/api/training-days/${training.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayName, exercises: training.exercises }) }));
        } else {
          ops.push(fetch("/api/training-days", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selectedClient!.id, dayName, exercises: training.exercises }) }));
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

  // ===================== DASHBOARD STATS =====================
  const totalClients = paymentStatuses.length;
  const activeClients = paymentStatuses.filter(c => c.status !== "vencido").length;
  const pendingClients = paymentStatuses.filter(c => c.status === "vencido").length;
  const upcomingClients = paymentStatuses.filter(c => c.status === "por_vencer");

  // ===================== RENDER =====================

  if (coachAuth === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (coachAuth === "login") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black italic text-slate-900 tracking-tighter">EMICOACH</h1>
            <p className="text-slate-500 text-sm mt-2">Acceso exclusivo Coach</p>
            <div className="mt-3 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg p-2">
              Demo: usuario <span className="font-mono font-bold">coach</span> / contraseña <span className="font-mono font-bold">coach1234</span> ó máster <span className="font-mono font-bold">EmiCoach2025</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold">Usuario Coach</label>
              <input type="text" value={coachUser} onChange={e => setCoachUser(e.target.value)} onKeyDown={e => e.key === "Enter" && coachLogin()} placeholder="coach" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300 mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold">Contraseña</label>
              <input type="password" value={coachPass} onChange={e => setCoachPass(e.target.value)} onKeyDown={e => e.key === "Enter" && coachLogin()} placeholder="••••••••" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300 mt-1" />
            </div>
            {coachError && <p className="text-red-600 text-sm">{coachError}</p>}
            <button onClick={coachLogin} disabled={coachLoading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {coachLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              Entrar como Coach
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black italic text-slate-900">EMICOACH</h1>
            <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Coach</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedClient && mainView === "clientes" && (
              <button onClick={save} disabled={saving || saved || clientTab === "progress" || clientTab === "info"} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${clientTab === "progress" || clientTab === "info" ? "hidden" : ""} ${saved ? "bg-green-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
                {saving ? "Guardando..." : saved ? "Guardado" : "Guardar"}
              </button>
            )}
            <button onClick={coachLogout} className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg hover:border-slate-900">
              Salir
            </button>
          </div>
        </div>
        {/* Main nav */}
        {!selectedClient && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-1">
            {([
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "clientes", label: "Clientes", icon: Users },
              { id: "pagos", label: "Pagos", icon: CreditCard },
            ] as { id: MainView; label: string; icon: typeof LayoutDashboard }[]).map(v => (
              <button key={v.id} onClick={() => setMainView(v.id)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${mainView === v.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                <v.icon size={15} /> {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* ============ DASHBOARD ============ */}
        {!selectedClient && mainView === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 mb-2"><Users size={16} /><span className="text-xs font-bold uppercase tracking-wider">Total Clientes</span></div>
                <p className="text-4xl font-black text-slate-900">{totalClients}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-green-600 mb-2"><Check size={16} /><span className="text-xs font-bold uppercase tracking-wider">Clientes Activos</span></div>
                <p className="text-4xl font-black text-green-600">{activeClients}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-red-600 mb-2"><AlertTriangle size={16} /><span className="text-xs font-bold uppercase tracking-wider">Pendientes de Pago</span></div>
                <p className="text-4xl font-black text-red-600">{pendingClients}</p>
              </div>
            </div>

            {upcomingClients.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Por vencer pronto</h3>
                <div className="space-y-2">
                  {upcomingClients.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl text-sm">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <span className="text-amber-700 font-medium">Vence {c.paidUntil ? fmtDate(c.paidUntil) : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-3">Resumen de clientes</h3>
              <div className="space-y-2">
                {paymentStatuses.map(c => {
                  const s = STATUS_STYLE[c.status];
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                  );
                })}
                {paymentStatuses.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Aún no hay clientes registrados</p>}
              </div>
            </div>
          </div>
        )}

        {/* ============ CLIENTES LIST ============ */}
        {!selectedClient && mainView === "clientes" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Clientes</h2>
                <p className="text-slate-500 text-sm">Gestiona rutinas, dietas y progreso</p>
              </div>
              <button onClick={() => setShowNewClient(true)} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
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
                  <button key={client.id} onClick={() => openClient(client)} className={`group bg-white p-5 rounded-2xl border shadow-sm hover:border-slate-900 transition-all text-left flex items-center gap-4 ${isInactive ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
                    <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <User size={22} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-400">@{client.username} · ${client.monthlyFee}/{PERIODICITY_OPTIONS.find(p => p.days === client.periodicityDays)?.label.toLowerCase() ?? "mes"}</p>
                    </div>
                    {isInactive && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">Inactivo</span>}
                    {!isInactive && s && <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>}
                    <ChevronRight className="text-slate-300 group-hover:text-slate-900" />
                  </button>
                );
              })}
              {clients.length === 0 && !showNewClient && <p className="text-center text-slate-400 py-12">No hay clientes aún. ¡Agrega el primero!</p>}
            </div>
          </div>
        )}

        {/* ============ PAGOS ============ */}
        {!selectedClient && mainView === "pagos" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-900">Pagos</h2>
              <p className="text-slate-500 text-sm">Controla vencimientos y registra pagos</p>
            </div>

            <div className="space-y-3">
              {[...paymentStatuses].sort((a, b) => (a.paidUntil ?? "").localeCompare(b.paidUntil ?? "")).map(c => {
                const s = STATUS_STYLE[c.status];
                const diff = c.paidUntil ? daysBetween(todayISO(), c.paidUntil) : null;
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      <div>
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">
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
                      <button onClick={() => setPayingClient(c)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                        Registrar pago
                      </button>
                    </div>
                  </div>
                );
              })}
              {paymentStatuses.length === 0 && <p className="text-center text-slate-400 py-12">No hay clientes aún.</p>}
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

        {/* ============ CLIENT DETAIL ============ */}
        {selectedClient && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setSelectedClient(null); setProgress(null); }} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
                <ArrowLeft size={18} /> Volver a Clientes
              </button>
              <div className="text-right">
                <h2 className="font-bold text-slate-900">{selectedClient.name}</h2>
                <p className="text-xs text-slate-400">@{selectedClient.username}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
            ) : (
              <>
                <div className="flex gap-1 mb-6 bg-slate-100 rounded-2xl p-1 w-fit">
                  {([
                    { id: "training", label: "Entrenamiento" },
                    { id: "diet", label: "Dieta" },
                    { id: "progress", label: "Progreso" },
                    { id: "info", label: "Info y Pago" },
                  ] as { id: ClientTab; label: string }[]).map(t => (
                    <button key={t.id} onClick={() => setClientTab(t.id)} className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${clientTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* TRAINING */}
                {clientTab === "training" && (
                  <>
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                      {DAYS.map(day => {
                        const hasTr = trainingDays.some(d => d.dayName === day && d.exercises.length > 0);
                        return (
                          <button key={day} onClick={() => setSelectedDay(day)} className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${selectedDay === day ? "bg-slate-900 text-white border-slate-900" : hasTr ? "bg-white border-slate-900/30 text-slate-700" : "bg-white border-slate-200 text-slate-500"}`}>
                            {day.slice(0, 3)}
                            {hasTr && selectedDay !== day && <span className="ml-1 w-1.5 h-1.5 bg-slate-900 rounded-full inline-block align-middle" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-800 text-lg">Ejercicios — {selectedDay}</h3>
                        <button onClick={addExercise} className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                          <Plus size={16} /> Ejercicio
                        </button>
                      </div>

                      {(!currentTraining || currentTraining.exercises.length === 0) && (
                        <div className="text-center py-16 text-slate-400">
                          <p className="text-4xl mb-3">🏋️</p>
                          <p className="font-medium">Sin ejercicios para {selectedDay}</p>
                        </div>
                      )}

                      {currentTraining?.exercises.map((ex, exIdx) => (
                        <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
                            <span className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">{exIdx + 1}</span>
                            <input type="text" placeholder="Nombre del ejercicio" value={ex.name} onChange={e => updateExerciseName(ex.id, e.target.value)} className="flex-1 bg-transparent font-semibold text-slate-900 outline-none placeholder:text-slate-400" />
                            <button onClick={() => removeExercise(ex.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                          </div>
                          <div className="p-5 space-y-2">
                            {ex.sets.map((s, sIdx) => (
                              <div key={sIdx} className="grid grid-cols-12 gap-2 items-center">
                                <span className="col-span-2 text-sm font-mono text-slate-500 text-center bg-slate-50 rounded-lg py-2">#{sIdx + 1}</span>
                                <input type="text" placeholder="ej. 12" value={s.reps} onChange={e => updateSetReps(ex.id, sIdx, e.target.value)} className="col-span-7 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
                                <button onClick={() => removeSet(ex.id, sIdx)} className="col-span-3 text-slate-300 hover:text-red-500 transition-colors flex justify-center"><Trash2 size={15} /></button>
                              </div>
                            ))}
                            <button onClick={() => addSet(ex.id)} className="mt-3 flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors border border-dashed border-slate-300 hover:border-slate-900 w-full justify-center py-2 rounded-xl">
                              <Plus size={15} /> Agregar serie
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* DIET */}
                {clientTab === "diet" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">Plan de Alimentación</h3>
                        <p className="text-xs text-slate-500">Dieta general · Aplica todos los días</p>
                      </div>
                      <button onClick={addMeal} className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                        <Plus size={16} /> Comida
                      </button>
                    </div>
                    {(!diet || diet.meals.length === 0) && (
                      <div className="text-center py-16 text-slate-400"><p className="text-4xl mb-3">🥗</p><p className="font-medium">Sin comidas asignadas</p></div>
                    )}
                    {diet?.meals.map((meal, idx) => (
                      <div key={meal.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
                          <span className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                          <input type="time" value={meal.time} onChange={e => updateMeal(meal.id, "time", e.target.value)} className="bg-transparent text-slate-700 font-semibold outline-none" />
                          <div className="flex-1" />
                          <button onClick={() => removeMeal(meal.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                        </div>
                        <div className="p-5">
                          <textarea placeholder="Descripción..." value={meal.description} onChange={e => updateMeal(meal.id, "description", e.target.value)} rows={3} className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PROGRESS */}
                {clientTab === "progress" && progress && (
                  <div className="space-y-6">
                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2"><Activity size={18} className="text-slate-700" /><h3 className="font-bold text-slate-900">Adherencia semanal</h3></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setWeekStart(addDaysDate(weekStart, -7))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft size={16} /></button>
                          <span className="text-xs font-bold text-slate-700 px-3">{fmtShort(weekStart)} – {fmtShort(addDaysDate(weekStart, 6))}</span>
                          <button onClick={() => setWeekStart(addDaysDate(weekStart, 7))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight size={16} /></button>
                        </div>
                      </div>
                      <WeekCalendar weekStart={weekStart} logs={progress.logs} trainingDays={trainingDays} />
                    </section>

                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><TrendingDown size={18} className="text-slate-700" /><div><h3 className="font-bold text-slate-900">Peso y medidas</h3><p className="text-xs text-slate-500">Registros del cliente</p></div></div>
                        <button onClick={() => setShowAddBody(true)} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800"><Plus size={14} /> Nuevo</button>
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
                        <p className="text-center text-slate-400 py-8 text-sm">Sin registros aún</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {progress.bodyProgress.slice(0, 12).map(b => (
                            <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                              <div>
                                <p className="font-bold text-slate-900">{fmtDate(b.recordDate)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {b.weight && <span className="font-semibold">{b.weight} kg</span>}
                                  {b.waist && <span> · Cintura {b.waist}cm</span>}
                                  {b.hip && <span> · Cadera {b.hip}cm</span>}
                                  {b.arm && <span> · Brazo {b.arm}cm</span>}
                                  {b.thigh && <span> · Muslo {b.thigh}cm</span>}
                                </p>
                              </div>
                              <button onClick={() => deleteBody(b.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      {showAddBody && <BodyForm onSave={saveBodyProgress} onCancel={() => setShowAddBody(false)} />}
                    </section>

                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><Activity size={18} className="text-slate-700" /><div><h3 className="font-bold text-slate-900">InBody / Composición corporal</h3><p className="text-xs text-slate-500">Métricas mensuales</p></div></div>
                        <button onClick={() => setShowAddInBody(true)} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800"><Plus size={14} /> Nuevo</button>
                      </div>
                      {progress.inbody.length > 0 && (
                        <div className="mb-5 space-y-5">
                          <ProgressChart data={progress.inbody.filter(i => i.bodyFatPercent).map(i => ({ date: i.recordDate, value: Number(i.bodyFatPercent) })).reverse()} label="Grasa Corporal" unit="%" color="#ef4444" />
                          <ProgressChart data={progress.inbody.filter(i => i.muscleMass).map(i => ({ date: i.recordDate, value: Number(i.muscleMass) })).reverse()} label="Masa Muscular" unit="kg" color="#16a34a" />
                        </div>
                      )}
                      {progress.inbody.length === 0 ? (
                        <p className="text-center text-slate-400 py-8 text-sm">Sin registros aún</p>
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
                  <div className="text-center py-20"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} /></div>
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
    </main>
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      body: JSON.stringify({ name, username, password, monthlyFee: monthlyFee || 0, periodicityDays, startDate }),
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-slate-900 mb-4">Agregar Cliente</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Nombre completo *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Usuario *</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="ej. juan.perez" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Contraseña *</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña para el cliente" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Monto a cobrar ($)</label>
          <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder="800" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Periodicidad</label>
          <select value={periodicityDays} onChange={e => setPeriodicityDays(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 bg-white">
            {PERIODICITY_OPTIONS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Fecha de inicio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={submit} disabled={saving} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50">
          {saving ? "Creando..." : "Crear Cliente"}
        </button>
        <button onClick={onCancel} className="border border-slate-200 px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="font-bold text-slate-900 mb-1">Registrar pago</h3>
        <p className="text-sm text-slate-500 mb-4">{client.name}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500">Monto</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" /></div>
          <div><label className="text-xs text-slate-500">Fecha de pago</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" /></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => onSave(client.id, amount, paymentDate)} className="flex-1 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800">Confirmar pago y activar</button>
          <button onClick={onCancel} className="border border-slate-200 px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
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
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><KeyRound size={16} /> Credenciales de acceso</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Usuario (compártelo con el cliente)</label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-mono text-slate-800">{client.username}</div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Nueva contraseña (dejar vacío para no cambiar)</label>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-4">Cobro y periodicidad</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Monto ($)</label>
            <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Periodicidad</label>
            <select value={periodicityDays} onChange={e => setPeriodicityDays(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 bg-white">
              {PERIODICITY_OPTIONS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={save} disabled={saving} className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-green-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar cambios"}
        </button>
      </section>

      {paymentStatus && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><CreditCard size={16} /> Estado de pago</h3>
          <div className="flex items-center justify-between mb-4">
            {s && <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>}
            <span className="text-sm text-slate-500">{paymentStatus.paidUntil ? `Vence: ${fmtDate(paymentStatus.paidUntil)}` : "Sin pagos registrados"}</span>
          </div>
          <button onClick={() => setShowPayModal(true)} className="w-full bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800">
            Registrar pago y activar
          </button>
        </section>
      )}

      {/* Acciones de cliente (activar/desactivar y eliminar) */}
      <section className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <h3 className="font-bold text-red-700 mb-4">Acciones peligrosas</h3>
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-800">Estado de la cuenta</p>
            <p className="text-xs text-slate-500">{isActive ? "El cliente puede iniciar sesión" : "El cliente no puede acceder a la app"}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isActive ? "bg-green-50 text-green-700" : "bg-slate-200 text-slate-600"}`}>
            {isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeactivateConfirm(true)}
            className={`flex-1 py-3 border rounded-xl text-sm font-semibold transition-colors ${isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-300 text-green-700 hover:bg-green-50"}`}
          >
            {isActive ? "Desactivar cliente" : "Activar cliente"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 py-3 border border-red-600 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors"
          >
            Eliminar cliente
          </button>
        </div>

        {showDeactivateConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-xs w-full">
              <p className="font-bold text-slate-900 mb-2">
                {isActive ? "¿Desactivar este cliente?" : "¿Activar este cliente?"}
              </p>
              <p className="text-sm text-slate-600 mb-5">
                {isActive
                  ? "El cliente perderá acceso inmediato a la app (no podrá ver su rutina, dieta ni progreso) hasta que lo reactives."
                  : "El cliente podrá volver a iniciar sesión y ver su información normalmente."}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm">Cancelar</button>
                <button
                  onClick={confirmToggleActive}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold text-white ${isActive ? "bg-red-600" : "bg-green-600"}`}
                >
                  {isActive ? "Sí, desactivar" : "Sí, activar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-xs w-full">
              <p className="font-bold text-red-700 mb-2">¿Eliminar cliente permanentemente?</p>
              <p className="text-sm text-slate-600 mb-5">Se borrarán todos sus entrenamientos, dietas, logs, mediciones e InBody. Esta acción es irreversible.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm">Cancelar</button>
                <button onClick={deleteClient} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold">Sí, eliminar</button>
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
            <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${isCompleted ? "bg-green-50 border-green-300" : hasRoutine ? "bg-slate-50 border-slate-200" : "bg-slate-50/50 border-dashed border-slate-200 opacity-60"} ${isToday ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isCompleted ? "text-green-700" : hasRoutine ? "text-slate-600" : "text-slate-400"}`}>{DAY_ABBR[DAYS[i]]}</span>
              <span className={`text-xl font-black ${isCompleted ? "text-green-700" : hasRoutine ? "text-slate-900" : "text-slate-300"}`}>{d.getDate()}</span>
              <span className="mt-0.5">
                {isCompleted ? (
                  <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><Check size={10} className="text-white" /></span>
                ) : hasRoutine ? (
                  <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                ) : (
                  <span className="text-[9px] text-slate-400">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500"><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>Días completados</span>
        <span className="font-bold text-slate-900">{completedCount}/{hasRoutineCount} días</span>
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
    <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nuevo registro</p>
      <div><label className="text-xs text-slate-500">Fecha</label><input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
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
    <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nuevo InBody</p>
      <div><label className="text-xs text-slate-500">Fecha</label><input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
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
        <button onClick={() => onSave({ recordDate, weight, bodyFatPercent, muscleMass, bmi, bodyWaterPercent, bmr, visceralFat, bodyAge: bodyAge ? Number(bodyAge) : null, notes })} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800">Guardar</button>
        <button onClick={onCancel} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-white">Cancelar</button>
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
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-bold">
            {new Date(record.recordDate + "T00:00").toLocaleDateString("es-MX", { month: "short" }).toUpperCase().slice(0, 3)}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{fmtDate(record.recordDate)}</p>
            <p className="text-xs text-slate-500">
              {record.weight && <span>{record.weight} kg</span>}
              {record.bodyFatPercent && <span> · {record.bodyFatPercent}% grasa</span>}
              {record.muscleMass && <span> · {record.muscleMass}kg músculo</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
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
          {record.notes && <p className="mt-3 text-sm text-slate-600 italic">&quot;{record.notes}&quot;</p>}
        </div>
      )}
    </div>
  );
}
