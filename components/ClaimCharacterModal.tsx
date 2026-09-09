"use client";

import React, { useEffect } from "react";
import { AvailabilityMap } from "@/lib/supabase";
import {
  Shield,
  Check,
  Eye,
  X,
  CalendarCheck,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

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
  const { t, locale } = useLanguage();

  const handleDismiss = React.useCallback(() => {
    if (canDismiss) {
      onClose();
    } else {
      onEnterAsSpectator();
    }
  }, [canDismiss, onClose, onEnterAsSpectator]);

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
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-xl animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg liquid-glass-elevated rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 overflow-hidden cursor-default"
      >
        {/* iOS Sheet Handle Indicator */}
        <div className="w-10 h-1 bg-white/25 rounded-full mx-auto -mt-1 mb-2" />

        {/* Glow de fondo */}
        <div
          className="absolute -right-20 -top-20 w-52 h-52 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, transparent 70%)",
          }}
        />

        {/* Botón de cerrar */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
          title={t("common.close")}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-subtle text-amber-300 text-xs font-bold border border-white/10 shadow-sm">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            {locale === "en" ? "Table Access" : "Acceso a la Mesa"}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
            {t("claimModal.title")}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            {locale === "en" ? "Campaign: " : "Campaña: "}
            <strong className="text-zinc-200">{campaignTitle}</strong>.{" "}
            {t("claimModal.subtitle")}
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
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group active:scale-[0.98] ${
                  isCurrent
                    ? "bg-amber-500/20 border-amber-400/60 shadow-lg shadow-amber-500/15"
                    : "liquid-glass-subtle border-white/10 hover:border-amber-400/40 hover:bg-white/[0.08]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm transition-colors ${
                      isCurrent
                        ? "ios-btn-amber text-zinc-950 shadow-md"
                        : "liquid-glass-subtle border border-white/15 text-amber-300 group-hover:bg-amber-500/20 group-hover:border-amber-400/40"
                    }`}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p
                      className={`text-sm font-bold truncate transition-colors ${
                        isCurrent
                          ? "text-amber-300 font-extrabold"
                          : "text-zinc-200 group-hover:text-amber-300"
                      }`}
                    >
                      {name}
                    </p>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <CalendarCheck className="w-3 h-3 text-zinc-400" />
                      {markedDays > 0 ? (
                        <span className="text-zinc-300 font-semibold">
                          {markedDays}{" "}
                          {locale === "en"
                            ? markedDays === 1 ? "day marked" : "days marked"
                            : markedDays === 1 ? "día marcado" : "días marcados"}
                        </span>
                      ) : (
                        <span className="text-zinc-500 italic">
                          {locale === "en" ? "No response yet" : "Sin responder aún"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl ios-btn-amber text-zinc-950 text-xs font-black shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {locale === "en" ? "Current" : "Actual"}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-3 py-1 rounded-xl border border-white/10 text-zinc-400 group-hover:text-amber-300 group-hover:border-amber-400/30 group-hover:bg-amber-500/10 transition-all">
                      {t("claimModal.selectBtn")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer: Modo espectador */}
        <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={onEnterAsSpectator}
            className="w-full sm:w-auto text-zinc-400 hover:text-amber-300 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl hover:bg-white/[0.06] transition-colors active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>
              {locale === "en"
                ? "View calendar only (Spectator / DM mode)"
                : "Solo ver calendario (Modo espectador / Master)"}
            </span>
          </button>

          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 font-bold rounded-2xl transition-colors border border-white/15 active:scale-95"
            >
              {locale === "en" ? "Keep current" : "Mantener actual"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
