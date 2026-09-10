"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
import { useTutorial } from "@/context/TutorialContext";
import { useLanguage } from "@/context/LanguageContext";

export default function TutorialFloatingButton() {
  const { setShowHelpModal, activeStep } = useTutorial();
  const { t } = useLanguage();

  // Ocultar el botón flotante si hay un tip del tutorial activo
  if (activeStep) return null;

  return (
    <button
      type="button"
      onClick={() => setShowHelpModal(true)}
      data-testid="tutorial-floating-btn"
      className="btn-floating group"
      title={t("tutorial.helpTitle")}
      aria-label={t("tutorial.helpTitle")}
    >
      <div className="relative flex items-center justify-center">
        <HelpCircle className="w-4 h-4 text-amber-400 transition-transform group-hover:rotate-12" />
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      </div>
      <span className="hidden sm:inline text-xs font-bold tracking-tight text-zinc-200 group-hover:text-white">
        {t("tutorial.badge")}
      </span>
    </button>
  );
}
