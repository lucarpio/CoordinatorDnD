"use client";

import React from "react";
import { AvailabilityMap } from "@/lib/supabase";
import { Shield, Check, Eye, CalendarCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Modal from "@/components/ui/Modal";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

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

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      testId="claim-character-modal"
      badge={
        <Badge variant="amber" icon={<Shield className="w-3.5 h-3.5 text-amber-400" />}>
          {locale === "en" ? "Table Access" : "Acceso a la Mesa"}
        </Badge>
      }
      title={t("claimModal.title")}
      subtitle={
        <span>
          {locale === "en" ? "Campaign: " : "Campaña: "}
          <strong className="text-zinc-200">{campaignTitle}</strong>. {t("claimModal.subtitle")}
        </span>
      }
    >
      {/* Lista de participantes para reclamar */}
      <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
        {participants.map((name) => {
          const isCurrent = currentSelectedPlayer === name;
          const markedDays = Object.values(availability || {}).filter(
            (voters) => voters && voters.includes(name)
          ).length;

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectPlayer(name)}
              data-testid={`claim-player-btn-${name.toLowerCase().replace(/\s+/g, "-")}`}
              aria-label={`${locale === "en" ? "Select player" : "Seleccionar jugador"} ${name}`}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group active:scale-[0.98] ${
                isCurrent
                  ? "bg-amber-500/20 border-amber-400/60 shadow-lg shadow-amber-500/15"
                  : "liquid-glass-subtle border-white/10 hover:border-amber-400/40 hover:bg-white/[0.08]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar name={name} isSelected={isCurrent} size="lg" />
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
                          ? markedDays === 1
                            ? "day marked"
                            : "days marked"
                          : markedDays === 1
                          ? "día marcado"
                          : "días marcados"}
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
                  <Badge variant="amber" icon={<Check className="w-3.5 h-3.5 stroke-[3]" />}>
                    {locale === "en" ? "Current" : "Actual"}
                  </Badge>
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
          data-testid="claim-spectator-btn"
          aria-label={
            locale === "en"
              ? "View calendar only (Spectator / DM mode)"
              : "Solo ver calendario (Modo espectador / Master)"
          }
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
          <Button
            variant="subtle"
            size="sm"
            onClick={onClose}
            data-testid="claim-keep-current-btn"
            aria-label={locale === "en" ? "Keep current character" : "Mantener personaje actual"}
            className="w-full sm:w-auto"
          >
            {locale === "en" ? "Keep current" : "Mantener actual"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
