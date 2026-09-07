"use client";

import React, { useState } from "react";
import { useTutorial } from "@/context/TutorialContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  X,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Users,
  CalendarCheck,
  Share2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function TutorialHelpModal() {
  const { showHelpModal, setShowHelpModal, resetTutorial } = useTutorial();
  const { t } = useLanguage();
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  if (!showHelpModal) return null;

  const handleReset = () => {
    resetTutorial();
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      setShowHelpModal(false);
    }, 1200);
  };

  const steps = [
    {
      icon: Users,
      title: t("tutorial.guideItems.item1Title"),
      desc: t("tutorial.guideItems.item1Desc"),
      color: "text-blue-400 bg-blue-500/15 border-blue-400/30",
    },
    {
      icon: ShieldCheck,
      title: t("tutorial.guideItems.item2Title"),
      desc: t("tutorial.guideItems.item2Desc"),
      color: "text-amber-400 bg-amber-500/15 border-amber-400/30",
    },
    {
      icon: CalendarCheck,
      title: t("tutorial.guideItems.item3Title"),
      desc: t("tutorial.guideItems.item3Desc"),
      color: "text-purple-400 bg-purple-500/15 border-purple-400/30",
    },
    {
      icon: Share2,
      title: t("tutorial.guideItems.item4Title"),
      desc: t("tutorial.guideItems.item4Desc"),
      color: "text-emerald-400 bg-emerald-500/15 border-emerald-400/30",
    },
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowHelpModal(false);
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in duration-200 cursor-pointer"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-zinc-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 cursor-default overflow-hidden ring-1 ring-white/10"
      >
        {/* iOS Sheet Grab Indicator */}
        <div className="w-10 h-1 bg-white/25 rounded-full mx-auto -mt-2 mb-2" />

        <button
          type="button"
          onClick={() => setShowHelpModal(false)}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-2xl hover:bg-white/10 transition-colors"
          title={t("common.close")}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>CoordinatorDnD</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight mt-1">
            {t("tutorial.helpTitle")}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {t("tutorial.helpSubtitle")}
          </p>
        </div>

        {/* Pasos Guía */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 rounded-2xl liquid-glass-subtle border border-white/10"
              >
                <div className={`p-2 rounded-xl border flex-shrink-0 ${step.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-200">
                    {step.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón de Reinicio del Tutorial */}
        <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetSuccess}
            className={`w-full py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md ${
              resetSuccess
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                : "ios-btn-amber text-zinc-950"
            }`}
          >
            {resetSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t("tutorial.resetSuccess")}</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>{t("tutorial.resetTutorialBtn")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
