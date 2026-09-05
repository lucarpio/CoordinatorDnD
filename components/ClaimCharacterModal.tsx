"use client";

import React, { useEffect } from "react";
import { AvailabilityMap } from "@/lib/supabase";
import {
  Shield,
  Dices,
  Check,
  Eye,
  X,
  UserCheck,
  CalendarCheck,
} from "lucide-react";

interface ClaimCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignTitle: string;
  participants: string[];
  availability: AvailabilityMap;
  currentSelectedPlayer: string;
  onSelectPlayer: (player: string) => void;
  onEnterAsSpectator: () => void;
  canDismiss?: boolean;
}

export default function ClaimCharacterModal({
  isOpen,
  onClose,
  campaignTitle,
  participants,
  availability,
  currentSelectedPlayer,
  onSelectPlayer,
  onEnterAsSpectator,
  canDismiss = false,
}: ClaimCharacterModalProps) {
  const handleDismiss = () => {
    if (canDismiss) {
      onClose();
    } else {
      onEnterAsSpectator();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, canDismiss, onClose, onEnterAsSpectator]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#0e1017] border border-zinc-800 rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 overflow-hidden cursor-default"
      >
        {/* Glow de fondo */}
        <div className="absolute -right-20 -top-20 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Botón de cerrar */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 rounded-xl transition-all"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
            <Shield className="w-3.5 h-3.5" />
            Acceso a la Mesa
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight">
            ¿Quién eres en esta mesa?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Campaña: <strong className="text-zinc-200">{campaignTitle}</strong>. Selecciona tu
            personaje para abrir tu calendario personal y marcar tu disponibilidad con 1 clic.
          </p>
        </div>

        {/* Lista de participantes para reclamar */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {participants.map((name) => {
            const isCurrent = currentSelectedPlayer === name;
            // Contar cuántos días ha votado este participante
            const markedDays = Object.values(availability || {}).filter(
              (voters) => voters && voters.includes(name)
            ).length;

            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectPlayer(name)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group active:scale-[0.99] ${
                  isCurrent
                    ? "bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10"
                    : "bg-zinc-950/70 border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-900/90"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${
                      isCurrent
                        ? "bg-amber-500 text-zinc-950 shadow-md"
                        : "bg-zinc-800/80 border border-zinc-700/80 text-amber-400 group-hover:bg-amber-500/20 group-hover:border-amber-500/40"
                    }`}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p
                      className={`text-sm font-bold truncate transition-colors ${
                        isCurrent
                          ? "text-amber-400"
                          : "text-zinc-200 group-hover:text-amber-300"
                      }`}
                    >
                      {name}
                    </p>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <CalendarCheck className="w-3 h-3 text-zinc-500" />
                      {markedDays > 0 ? (
                        <span className="text-zinc-400 font-medium">
                          {markedDays} {markedDays === 1 ? "día marcado" : "días marcados"}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Sin responder aún</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Actual
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-3 py-1 rounded-lg border border-zinc-800 text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 group-hover:bg-amber-500/10 transition-all">
                      Elegir
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer: Modo espectador */}
        <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={onEnterAsSpectator}
            className="w-full sm:w-auto text-zinc-400 hover:text-amber-400 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Solo ver calendario (Modo espectador / Master)</span>
          </button>

          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-colors"
            >
              Mantener actual
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
