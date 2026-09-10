"use client";

import React, { useState } from "react";
import { useTutorial } from "@/context/TutorialContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  HelpCircle,
  RotateCcw,
  Users,
  CalendarCheck,
  Share2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface GuideItemConfig {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
  color: string;
}

const GUIDE_ITEMS_CONFIG: GuideItemConfig[] = [
  {
    id: "create-room",
    icon: Users,
    titleKey: "tutorial.guideItems.item1Title",
    descKey: "tutorial.guideItems.item1Desc",
    color: "text-blue-400 bg-blue-500/15 border-blue-400/30",
  },
  {
    id: "claim-character",
    icon: ShieldCheck,
    titleKey: "tutorial.guideItems.item2Title",
    descKey: "tutorial.guideItems.item2Desc",
    color: "text-amber-400 bg-amber-500/15 border-amber-400/30",
  },
  {
    id: "mark-availability",
    icon: CalendarCheck,
    titleKey: "tutorial.guideItems.item3Title",
    descKey: "tutorial.guideItems.item3Desc",
    color: "text-purple-400 bg-purple-500/15 border-purple-400/30",
  },
  {
    id: "quorum-export",
    icon: Share2,
    titleKey: "tutorial.guideItems.item4Title",
    descKey: "tutorial.guideItems.item4Desc",
    color: "text-emerald-400 bg-emerald-500/15 border-emerald-400/30",
  },
];

export default function TutorialHelpModal() {
  const { showHelpModal, setShowHelpModal, resetTutorial } = useTutorial();
  const { t } = useLanguage();
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Limpiar timer si el modal se desmonta
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Memorizar pasos traducidos para no recalcular en cada render
  const steps = React.useMemo(() => {
    return GUIDE_ITEMS_CONFIG.map((item) => ({
      id: item.id,
      icon: item.icon,
      title: t(item.titleKey),
      desc: t(item.descKey),
      color: item.color,
    }));
  }, [t]);

  const handleReset = React.useCallback(() => {
    resetTutorial();
    setResetSuccess(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setResetSuccess(false);
      setShowHelpModal(false);
    }, 1200);
  }, [resetTutorial, setShowHelpModal]);

  if (!showHelpModal) return null;

  return (
    <Modal
      isOpen={showHelpModal}
      onClose={() => setShowHelpModal(false)}
      testId="tutorial-help-modal"
      badge={
        <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" />
          <span>CoordinatorDnD</span>
        </div>
      }
      title={t("tutorial.helpTitle")}
      subtitle={t("tutorial.helpSubtitle")}
    >
      {/* Pasos Guía */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
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
        <Button
          type="button"
          variant={resetSuccess ? "emerald" : "amber"}
          size="md"
          fullWidth
          onClick={handleReset}
          disabled={resetSuccess}
          data-testid="tutorial-reset-btn"
          aria-label={resetSuccess ? t("tutorial.resetSuccess") : t("tutorial.resetTutorialBtn")}
          icon={
            resetSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )
          }
        >
          {resetSuccess ? t("tutorial.resetSuccess") : t("tutorial.resetTutorialBtn")}
        </Button>
      </div>
    </Modal>
  );
}
