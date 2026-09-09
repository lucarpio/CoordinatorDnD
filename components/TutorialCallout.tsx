"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useTutorial } from "@/context/TutorialContext";
import { useLanguage } from "@/context/LanguageContext";
import { Sparkles, X, Check } from "lucide-react";

interface TutorialCalloutProps {
  stepId: string;
  title?: string;
  description?: string;
  currentStepNumber?: number;
  totalSteps?: number;
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onNext?: () => void;
  className?: string;
}

export default function TutorialCallout({
  stepId,
  title,
  description,
  onNext,
}: TutorialCalloutProps) {
  const { activeStep, completeStep, dismissAll } = useTutorial();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState<boolean>(false);
  const beaconRef = useRef<HTMLSpanElement>(null);

  const isVisible = activeStep === stepId;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hacer scroll suave hacia el elemento cuando el paso se activa
  useEffect(() => {
    if (!isVisible || !beaconRef.current) return;

    const timer = setTimeout(() => {
      beaconRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [isVisible]);

  // Cierre accesible con tecla Escape
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        completeStep(stepId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, stepId, completeStep]);

  if (!isVisible) return null;

  const displayTitle = title || t(`tutorial.steps.${stepId}.title`);
  const displayDesc = description || t(`tutorial.steps.${stepId}.desc`);

  const handleGotIt = () => {
    if (onNext) {
      onNext();
    }
    completeStep(stepId);
  };

  // El card flotante se renderiza directamente en document.body para que sea
  // verdaderamente position: fixed relativo al viewport y siga al usuario en el scroll,
  // sin verse atrapado por backdrop-filter ni overflow de los contenedores padre.
  const floatingCard = mounted ? (
    createPortal(
      <div
        className="fixed bottom-5 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] max-w-[calc(100vw-24px)] z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        role="dialog"
        aria-label={displayTitle}
      >
        {/* Contenedor Liquid Glass flotante con resplandor ámbar */}
        <div className="relative bg-zinc-950/95 backdrop-blur-2xl border border-amber-400/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-amber-500/25 ring-1 ring-white/10 space-y-3">
          {/* Cabecera del Callout */}
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                {t("tutorial.badge")}
              </span>
            </div>

            <button
              type="button"
              onClick={() => completeStep(stepId)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title={t("common.close")}
              aria-label={t("common.close")}
              data-testid="tutorial-callout-close-btn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Contenido */}
          <div className="space-y-1">
            <h4 className="text-sm font-black text-zinc-100 tracking-tight leading-snug">
              {displayTitle}
            </h4>
            <p className="text-xs text-zinc-300/90 leading-relaxed">
              {displayDesc}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              onClick={dismissAll}
              data-testid="tutorial-callout-dismiss-btn"
              aria-label={t("tutorial.dismiss")}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors underline-offset-2 hover:underline"
            >
              {t("tutorial.dismiss")}
            </button>

            <button
              type="button"
              onClick={handleGotIt}
              data-testid="tutorial-callout-got-it-btn"
              aria-label={t("tutorial.gotIt")}
              className="ios-btn-amber text-zinc-950 font-black text-xs px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <span>{t("tutorial.gotIt")}</span>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      {/* Beacon pulsante situado en el elemento específico de la página */}
      <span
        ref={beaconRef}
        className="absolute -top-1.5 -left-1.5 flex h-4 w-4 pointer-events-none z-30"
        aria-hidden="true"
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-[#08090d] shadow-sm" />
      </span>

      {/* Modal flotante portaleado directamente al viewport para seguir el scroll */}
      {floatingCard}
    </>
  );
}
