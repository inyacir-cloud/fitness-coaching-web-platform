import Link from "next/link";
import { User, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter italic">EMICOACH</h1>
          <div className="h-1 w-12 bg-slate-900 mx-auto rounded-full mb-6"></div>
          <p className="text-slate-500 font-medium text-lg">Tu evolución comienza aquí.</p>
        </div>

        <div className="space-y-4">
          <Link 
            href="/coach"
            className="group flex items-center gap-4 p-5 bg-slate-900 hover:bg-slate-800 transition-all rounded-2xl text-white shadow-lg shadow-slate-200"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <div className="text-left">
              <span className="block text-lg font-bold">Soy Coach</span>
              <span className="text-xs text-slate-400">Gestionar rutinas y dietas</span>
            </div>
          </Link>

          <Link 
            href="/cliente"
            className="group flex items-center gap-4 p-5 bg-white border border-slate-200 hover:border-slate-900 transition-all rounded-2xl text-slate-900"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-slate-900 group-hover:text-white">
              <User size={24} />
            </div>
            <div className="text-left">
              <span className="block text-lg font-bold italic">Soy Cliente</span>
              <span className="text-xs text-slate-500">Consultar mi plan de hoy</span>
            </div>
          </Link>
        </div>

        <footer className="mt-12 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest">
          &copy; 2026 EMICOACH SYSTEM
        </footer>
      </div>
    </main>
  );
}
