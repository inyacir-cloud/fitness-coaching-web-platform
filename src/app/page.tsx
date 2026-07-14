import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck, User } from "lucide-react";

export default function Home() {
  return (
    <main className="neon-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <section className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-5">
              <span className="neon-kicker">
                <Activity size={14} />
                Performance Coaching Platform
              </span>
              <div className="space-y-4">
                <h1 className="neon-title max-w-3xl text-5xl font-extrabold sm:text-6xl lg:text-7xl">
                  EMICOACH
                </h1>
                <p className="neon-copy max-w-2xl text-lg sm:text-xl">
                  Una plataforma con energia de alto rendimiento para llevar rutinas, nutricion y progreso en una sola experiencia.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="neon-stat neon-panel-soft">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200/80">Ritmo</p>
                <p className="mt-3 text-3xl font-extrabold text-white">24/7</p>
                <p className="mt-2 text-sm text-slate-300">Seguimiento continuo y acceso inmediato.</p>
              </div>
              <div className="neon-stat neon-panel-soft">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-200/80">Progreso</p>
                <p className="mt-3 text-3xl font-extrabold text-[var(--green)]">+360</p>
                <p className="mt-2 text-sm text-slate-300">Control visual de adherencia, pagos y evolucion.</p>
              </div>
              <div className="neon-stat neon-panel-soft">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-200/80">Precision</p>
                <p className="mt-3 text-3xl font-extrabold text-white">1 panel</p>
                <p className="mt-2 text-sm text-slate-300">Coach y cliente conectados con una sola interfaz.</p>
              </div>
            </div>
          </div>

          <div className="neon-panel neon-outline relative rounded-[2rem] p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200/70">Access Portal</p>
                <h2 className="mt-2 text-2xl font-extrabold uppercase text-white">Elige tu modo</h2>
              </div>
              <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
                Neon Performance
              </div>
            </div>

            <div className="space-y-4">
              <Link
                href="/coach"
                className="neon-link-card group flex items-center gap-4 p-5 sm:p-6"
              >
                <div className="neon-glow-cyan flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                  <ShieldCheck size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-bold uppercase tracking-[0.28em] text-cyan-200/70">Coach Mode</span>
                  <span className="mt-2 block text-2xl font-extrabold text-white">Control total del sistema</span>
                  <span className="mt-2 block text-sm text-slate-300">Administra clientes, rutina, pagos y progreso desde un panel central.</span>
                </div>
                <ArrowRight className="shrink-0 text-cyan-200 transition-transform group-hover:translate-x-1" size={20} />
              </Link>

              <Link
                href="/cliente"
                className="neon-link-card group flex items-center gap-4 p-5 sm:p-6"
              >
                <div className="neon-glow-green flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lime-300/10 text-lime-200">
                  <User size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-bold uppercase tracking-[0.28em] text-lime-200/70">Client Mode</span>
                  <span className="mt-2 block text-2xl font-extrabold text-white">Rutina de hoy y avances</span>
                  <span className="mt-2 block text-sm text-slate-300">Consulta tu plan, registra series y sigue tu progreso corporal desde movil.</span>
                </div>
                <ArrowRight className="shrink-0 text-lime-200 transition-transform group-hover:translate-x-1" size={20} />
              </Link>
            </div>

            <footer className="mt-6 flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-400">
              <span>Emicoach System</span>
              <span>2026</span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
