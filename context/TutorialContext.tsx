"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "coordinator_tutorial_progress";

export interface TutorialState {
  completedSteps: string[];
  isDismissedAll: boolean;
}

interface TutorialContextType {
  activeStep: string | null;
  completedSteps: string[];
  isDismissedAll: boolean;
  showHelpModal: boolean;
  setShowHelpModal: (show: boolean) => void;
  triggerStep: (stepId: string) => void;
  completeStep: (stepId: string) => void;
  dismissStep: (stepId: string) => void;
  dismissAll: () => void;
  resetTutorial: () => void;
  isStepCompleted: (stepId: string) => boolean;
  isStepActive: (stepId: string) => boolean;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isDismissedAll, setIsDismissedAll] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Cargar estado inicial desde localStorage de forma segura
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TutorialState;
        if (Array.isArray(parsed.completedSteps)) {
          setCompletedSteps(parsed.completedSteps);
        }
        if (typeof parsed.isDismissedAll === "boolean") {
          setIsDismissedAll(parsed.isDismissedAll);
        }
      }
    } catch {
      // Ignorar errores en navegadores con storage restringido
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Guardar en localStorage cuando cambie el progreso
  const saveState = useCallback((steps: string[], dismissedAll: boolean) => {
    try {
      const data: TutorialState = {
        completedSteps: steps,
        isDismissedAll: dismissedAll,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignorar errores de storage
    }
  }, []);

  const triggerStep = useCallback(
    (stepId: string) => {
      if (!isLoaded || isDismissedAll) return;
      // Si ya fue completado, no volver a disparar
      if (completedSteps.includes(stepId)) return;
      setActiveStep(stepId);
    },
    [isLoaded, isDismissedAll, completedSteps]
  );

  const completeStep = useCallback(
    (stepId: string) => {
      setCompletedSteps((prev) => {
        if (prev.includes(stepId)) return prev;
        const next = [...prev, stepId];
        saveState(next, isDismissedAll);
        return next;
      });
      setActiveStep((current) => (current === stepId ? null : current));
    },
    [isDismissedAll, saveState]
  );

  const dismissStep = useCallback(
    (stepId: string) => {
      completeStep(stepId);
    },
    [completeStep]
  );

  const dismissAll = useCallback(() => {
    setIsDismissedAll(true);
    setActiveStep(null);
    saveState(completedSteps, true);
  }, [completedSteps, saveState]);

  const resetTutorial = useCallback(() => {
    setCompletedSteps([]);
    setIsDismissedAll(false);
    setActiveStep(null);
    saveState([], false);
  }, [saveState]);

  const isStepCompleted = useCallback(
    (stepId: string) => {
      return completedSteps.includes(stepId);
    },
    [completedSteps]
  );

  const isStepActive = useCallback(
    (stepId: string) => {
      return activeStep === stepId;
    },
    [activeStep]
  );

  return (
    <TutorialContext.Provider
      value={{
        activeStep,
        completedSteps,
        isDismissedAll,
        showHelpModal,
        setShowHelpModal,
        triggerStep,
        completeStep,
        dismissStep,
        dismissAll,
        resetTutorial,
        isStepCompleted,
        isStepActive,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}
