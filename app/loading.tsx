import React from "react";
import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-5 animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center">
        {/* Resplandor ambiental ámbar */}
        <div className="absolute w-24 h-24 bg-amber-500/20 rounded-full blur-xl pointer-events-none animate-pulse" />

        {/* Tarjeta de carga Liquid Glass */}
        <div className="relative w-20 h-20 rounded-3xl liquid-glass-elevated border border-white/15 flex items-center justify-center shadow-2xl">
          <span className="text-2xl animate-bounce select-none">🎲</span>
          <Loader2 className="absolute inset-0 m-auto w-12 h-12 text-amber-400/50 animate-spin" />
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-zinc-200 text-sm font-bold tracking-tight">
          Cargando CoordinatorDnD...
        </p>
        <p className="text-zinc-500 text-xs">
          Preparando la mesa de rol
        </p>
      </div>
    </div>
  );
}
