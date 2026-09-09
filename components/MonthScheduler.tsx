"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Calendar as CalendarIcon,
  Check,
  Copy,
  Download,
  Share2,
  Sparkles,
  Users,
  Radio,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Info,
  CalendarPlus,
  Shield,
  Dices,
  Loader2,
  Eye,
  X,
  LayoutGrid,
  List,
  Plus,
  MessageSquare,
  Edit3,
  Trash2,
} from "lucide-react";
import { Poll, AvailabilityMap, DateComment, DateCommentsMap } from "@/lib/supabase";
import ClaimCharacterModal from "@/components/ClaimCharacterModal";
import { saveCreatedPoll } from "@/lib/storage";
import {
  getMonthDays,
  MONTH_NAMES,
  WEEKDAYS,
  formatFriendlyDate,
  formatDateKey,
  generateWhatsAppSummary,
  generateGoogleCalendarUrl,
  generateIcsContent,
  downloadIcsFile,
  CalendarDay,
  SupportedLocale,
} from "@/lib/calendarUtils";
import { useLanguage } from "@/context/LanguageContext";
import { useTutorial } from "@/context/TutorialContext";
import TutorialCallout from "@/components/TutorialCallout";

const WEEKDAY_NAMES_SHORT: Record<SupportedLocale, string[]> = {
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

/**
 * Formatea el tiempo relativo de un comentario (ej: 5m, 2h, o fecha corta)
 */
function formatCommentTime(isoString: string, currentLocale: SupportedLocale): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return currentLocale === "en" ? "Just now" : "Recién";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString(currentLocale === "en" ? "en-US" : "es-ES", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

interface MonthSchedulerProps {
  initialPoll: Poll;
  onUpdateAvailability: (newAvailability: AvailabilityMap, newComments?: DateCommentsMap) => Promise<boolean>;
  onUpdateComments?: (newComments: DateCommentsMap) => Promise<boolean>;
  isRealtimeConnected: boolean;
}

export default function MonthScheduler({
  initialPoll,
  onUpdateAvailability,
  onUpdateComments,
  isRealtimeConnected,
}: MonthSchedulerProps) {
  const { t, locale } = useLanguage();
  const { triggerStep, completeStep, isStepCompleted } = useTutorial();
  const [poll, setPoll] = useState<Poll>(initialPoll);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [isSpectator, setIsSpectator] = useState<boolean>(false);
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);
  const [activeDayModal, setActiveDayModal] = useState<CalendarDay | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showGoogleDropdown, setShowGoogleDropdown] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [listFilter, setListFilter] = useState<"all" | "weekends" | "quorum">("all");
  const googleDropdownRef = useRef<HTMLDivElement>(null);

  // En dispositivos móviles (pantallas < 640px), activar por defecto la vista Lista/Agenda
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setViewMode("list");
    }
  }, []);

  // Cerrar dropdown de Google Calendar al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (googleDropdownRef.current && !googleDropdownRef.current.contains(event.target as Node)) {
        setShowGoogleDropdown(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowGoogleDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Cerrar modal de detalle de día al presionar Escape
  useEffect(() => {
    if (!activeDayModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDayModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDayModal]);

  // Referencias para evitar condiciones de carrera en clics rápidos y sincronización
  const availabilityRef = useRef<AvailabilityMap>(initialPoll.availability);
  const commentsRef = useRef<DateCommentsMap>(initialPoll.comments || {});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quickNoteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<{ availability: AvailabilityMap; comments?: DateCommentsMap } | null>(null);
  const selectedPlayerRef = useRef<string>(selectedPlayer);

  // Estados para notas y comentarios
  const [quickNoteDate, setQuickNoteDate] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState<string>("");
  const [isEditingComment, setIsEditingComment] = useState<boolean>(false);
  const [isSavingComment, setIsSavingComment] = useState<boolean>(false);

  useEffect(() => {
    selectedPlayerRef.current = selectedPlayer;
  }, [selectedPlayer]);

  // Sincronizar estado local con props entrantes (Realtime)
  useEffect(() => {
    // Si tenemos clics pendientes de guardar o se están guardando localmente,
    // fusionamos para preservar la selección activa del jugador actual sin que se borren
    if (debounceTimerRef.current !== null || isSavingRef.current || pendingSaveRef.current !== null) {
      if (selectedPlayer && initialPoll.availability) {
        const merged: AvailabilityMap = { ...initialPoll.availability };
        const currentPlayer = selectedPlayer;

        Object.keys(availabilityRef.current).forEach((date) => {
          const localHasPlayer = availabilityRef.current[date]?.includes(currentPlayer);
          const remoteVoters = merged[date] || [];
          const remoteHasPlayer = remoteVoters.includes(currentPlayer);

          if (localHasPlayer && !remoteHasPlayer) {
            merged[date] = [...remoteVoters, currentPlayer];
          } else if (!localHasPlayer && remoteHasPlayer) {
            merged[date] = remoteVoters.filter((p) => p !== currentPlayer);
          }
        });

        availabilityRef.current = merged;
        commentsRef.current = initialPoll.comments || {};
        setPoll((prev) => ({
          ...initialPoll,
          availability: merged,
          comments: initialPoll.comments || {},
        }));
        return;
      }
    }

    availabilityRef.current = initialPoll.availability;
    commentsRef.current = initialPoll.comments || {};
    setPoll(initialPoll);
  }, [initialPoll]);

  // Auto-descartar el banner de nota rápida tras 5 segundos
  useEffect(() => {
    if (!quickNoteDate) return;
    if (quickNoteTimerRef.current) {
      clearTimeout(quickNoteTimerRef.current);
    }
    quickNoteTimerRef.current = setTimeout(() => {
      setQuickNoteDate(null);
    }, 5000);
    return () => {
      if (quickNoteTimerRef.current) {
        clearTimeout(quickNoteTimerRef.current);
      }
    };
  }, [quickNoteDate]);

  // Sincronizar formulario de comentario cuando se abre el modal de detalle
  useEffect(() => {
    if (!activeDayModal || !selectedPlayer) {
      setCommentInput("");
      setIsEditingComment(false);
      return;
    }
    const currentComments = poll.comments?.[activeDayModal.dateString] || [];
    const existing = currentComments.find((c) => c.author === selectedPlayer);
    if (existing) {
      setCommentInput(existing.text);
      setIsEditingComment(false);
    } else {
      setCommentInput("");
      setIsEditingComment(false);
    }
  }, [activeDayModal, selectedPlayer, poll.comments]);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (quickNoteTimerRef.current) {
        clearTimeout(quickNoteTimerRef.current);
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Recordar al jugador en localStorage o invitar a reclamar personaje
  useEffect(() => {
    const storageKey = `dnd_player_${poll.slug}`;
    let savedPlayer: string | null = null;
    let isSpectatorSession: string | null = null;

    try {
      savedPlayer = localStorage.getItem(storageKey);
      isSpectatorSession = sessionStorage.getItem(`dnd_spectator_${poll.slug}`);
    } catch {
      // Ignorar restricciones de storage en navegadores seguros
    }

    if (savedPlayer && poll.participants.includes(savedPlayer)) {
      setSelectedPlayer(savedPlayer);
      if (!isStepCompleted("room_vote")) {
        const timer = setTimeout(() => triggerStep("room_vote"), 600);
        return () => clearTimeout(timer);
      }
    } else {
      if (isSpectatorSession) {
        setIsSpectator(true);
      } else {
        setShowClaimModal(true);
        const timer = setTimeout(() => triggerStep("room_claim"), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [poll.slug, poll.participants, triggerStep, isStepCompleted]);

  const handleClaimPlayer = (player: string) => {
    setSelectedPlayer(player);
    setIsSpectator(false);
    setShowClaimModal(false);

    try {
      localStorage.setItem(`dnd_player_${poll.slug}`, player);
      sessionStorage.removeItem(`dnd_spectator_${poll.slug}`);
    } catch {
      // Ignorar restricciones de storage
    }

    // Guardar / actualizar en "Mis Mesas" para que el jugador nunca pierda el acceso
    saveCreatedPoll({
      slug: poll.slug,
      title: poll.title,
      year: poll.year,
      month: poll.month,
      createdAt: poll.created_at || new Date().toISOString(),
      participantsCount: poll.participants.length,
      myCharacter: player,
    });

    completeStep("room_claim");
    setTimeout(() => {
      triggerStep("room_vote");
    }, 400);
  };

  const handleEnterAsSpectator = () => {
    setSelectedPlayer("");
    setIsSpectator(true);
    setShowClaimModal(false);
    sessionStorage.setItem(`dnd_spectator_${poll.slug}`, "true");

    completeStep("room_claim");
    setTimeout(() => {
      triggerStep("room_views");
    }, 400);
  };

  const handleOpenClaimModal = () => {
    setShowClaimModal(true);
  };

  const playerMarkedDatesCount = useMemo(() => {
    if (!selectedPlayer) return 0;
    return Object.values(poll.availability || {}).filter(
      (voters) => voters && voters.includes(selectedPlayer)
    ).length;
  }, [poll.availability, selectedPlayer]);

  const todayDateStr = useMemo(() => formatDateKey(new Date()), []);

  const calendarDays = useMemo(() => {
    return getMonthDays(poll.year, poll.month);
  }, [poll.year, poll.month]);

  const currentMonthDays = useMemo(() => {
    return calendarDays.filter((d) => d.isCurrentMonth);
  }, [calendarDays]);

  const upcomingMonthDays = useMemo(() => {
    return currentMonthDays.filter((d) => d.dateString >= todayDateStr);
  }, [currentMonthDays, todayDateStr]);

  const filteredListDays = useMemo(() => {
    return currentMonthDays.filter((cellDay) => {
      // Excluir estrictamente fechas pasadas en la vista de agenda
      if (cellDay.dateString < todayDateStr) {
        return false;
      }

      const voters = poll.availability[cellDay.dateString] || [];
      const voterCount = voters.length;
      const dayOfWeek = cellDay.date.getDay();
      const isWeekendOrFriday = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

      if (listFilter === "weekends") {
        return isWeekendOrFriday;
      }
      if (listFilter === "quorum") {
        return voterCount > 0;
      }
      return true;
    });
  }, [currentMonthDays, listFilter, poll.availability, todayDateStr]);

  const totalParticipants = poll.participants.length;

  // Lista de fechas que alcanzaron quórum estricto (100%)
  const confirmedDates = useMemo(() => {
    if (totalParticipants === 0) return [];
    return Object.entries(poll.availability)
      .filter(([_, voters]) => voters && voters.length >= totalParticipants)
      .map(([date]) => date)
      .sort();
  }, [poll.availability, totalParticipants]);

  // Función para ejecutar el guardado debounced a Supabase
  const flushPendingSave = useCallback(async () => {
    if (!pendingSaveRef.current || isSavingRef.current) return;

    const dataToSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    isSavingRef.current = true;

    try {
      await onUpdateAvailability(dataToSave.availability, dataToSave.comments);
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        await flushPendingSave();
      } else {
        setIsUpdating(false);
      }
    }
  }, [onUpdateAvailability]);

  const triggerDebouncedSave = useCallback((newAvailability: AvailabilityMap, newComments?: DateCommentsMap) => {
    pendingSaveRef.current = {
      availability: newAvailability,
      comments: newComments ?? commentsRef.current,
    };
    setIsUpdating(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      flushPendingSave();
    }, 350);
  }, [flushPendingSave]);

  // Alternar disponibilidad del jugador actual para una fecha de manera inmediata y fluida
  const toggleDateAvailability = (dateStr: string) => {
    if (dateStr < todayDateStr) {
      return;
    }

    if (!selectedPlayer) {
      return;
    }

    // Leemos de availabilityRef.current para garantizar que NUNCA usamos un snapshot desactualizado
    const currentAvailability = availabilityRef.current;
    const currentVoters = currentAvailability[dateStr] || [];
    const isCurrentlyAvailable = currentVoters.includes(selectedPlayer);

    const updatedVoters = isCurrentlyAvailable
      ? currentVoters.filter((name) => name !== selectedPlayer)
      : [...currentVoters, selectedPlayer];

    const nextAvailability: AvailabilityMap = {
      ...currentAvailability,
      [dateStr]: updatedVoters,
    };

    // 1. Actualizamos la referencia sincrónicamente al instante
    availabilityRef.current = nextAvailability;

    // 2. Manejo de notas:
    let nextComments: DateCommentsMap = commentsRef.current || {};
    if (isCurrentlyAvailable) {
      // Si el jugador se desmarca, se elimina automáticamente su nota para ese día
      const dateComments = nextComments[dateStr] || [];
      if (dateComments.some((c) => c.author === selectedPlayer)) {
        nextComments = {
          ...nextComments,
          [dateStr]: dateComments.filter((c) => c.author !== selectedPlayer),
        };
        commentsRef.current = nextComments;
      }
      if (quickNoteDate === dateStr) {
        setQuickNoteDate(null);
      }
    } else {
      // Si se marca disponible, activamos el aviso de "Añadir nota"
      setQuickNoteDate(dateStr);
    }

    // 3. Actualizamos el estado de React inmediatamente para respuesta visual instantánea
    setPoll((prev) => ({
      ...prev,
      availability: nextAvailability,
      comments: nextComments,
    }));

    // 4. Celebración con confeti si con este voto se alcanza el 100% de quórum
    if (!isCurrentlyAvailable && updatedVoters.length === totalParticipants && totalParticipants > 0) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#10b981", "#34d399", "#d4af37", "#f59e0b", "#6366f1"],
      });
    }

    // 5. Guardado debounced (agrupa clics seguidos en una sola petición)
    triggerDebouncedSave(nextAvailability, nextComments);

    // 6. Progreso del tutorial interactivo
    completeStep("room_vote");
    if (!isStepCompleted("room_views")) {
      setTimeout(() => {
        triggerStep("room_views");
      }, 600);
    }
  };

  // Guardar o actualizar comentario de una fecha
  const handleSaveComment = async (dateStr: string, text: string) => {
    if (!selectedPlayer || !text.trim()) return;

    setIsSavingComment(true);
    try {
      const trimmed = text.trim().slice(0, 140);
      const currentComments = commentsRef.current || {};
      const dateComments = currentComments[dateStr] || [];
      const existingIndex = dateComments.findIndex((c) => c.author === selectedPlayer);

      let updatedList: DateComment[];
      if (existingIndex >= 0) {
        updatedList = [...dateComments];
        updatedList[existingIndex] = {
          ...updatedList[existingIndex],
          text: trimmed,
          createdAt: new Date().toISOString(),
        };
      } else {
        const newComment: DateComment = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          author: selectedPlayer,
          text: trimmed,
          createdAt: new Date().toISOString(),
        };
        updatedList = [...dateComments, newComment];
      }

      const nextComments: DateCommentsMap = {
        ...currentComments,
        [dateStr]: updatedList,
      };

      commentsRef.current = nextComments;
      setPoll((prev) => ({ ...prev, comments: nextComments }));
      setIsEditingComment(false);

      if (onUpdateComments) {
        await onUpdateComments(nextComments);
      } else {
        await onUpdateAvailability(availabilityRef.current, nextComments);
      }
    } finally {
      setIsSavingComment(false);
    }
  };

  // Eliminar comentario de una fecha
  const handleDeleteComment = async (dateStr: string, commentId: string) => {
    if (!selectedPlayer) return;

    setIsSavingComment(true);
    try {
      const currentComments = commentsRef.current || {};
      const dateComments = currentComments[dateStr] || [];
      const commentToDelete = dateComments.find((c) => c.id === commentId);

      if (!commentToDelete || commentToDelete.author !== selectedPlayer) return;

      const updatedList = dateComments.filter((c) => c.id !== commentId);
      const nextComments: DateCommentsMap = {
        ...currentComments,
        [dateStr]: updatedList,
      };

      commentsRef.current = nextComments;
      setPoll((prev) => ({ ...prev, comments: nextComments }));
      setCommentInput("");
      setIsEditingComment(false);

      if (onUpdateComments) {
        await onUpdateComments(nextComments);
      } else {
        await onUpdateAvailability(availabilityRef.current, nextComments);
      }
    } finally {
      setIsSavingComment(false);
    }
  };

  // Disparar tip de exportación cuando se alcance al menos 1 fecha con quórum 100%
  useEffect(() => {
    if (confirmedDates.length > 0 && !isStepCompleted("room_export")) {
      const timer = setTimeout(() => {
        triggerStep("room_export");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [confirmedDates.length, isStepCompleted, triggerStep]);


  const handleCopyWhatsApp = () => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    const summary = generateWhatsAppSummary(
      poll.title,
      poll.year,
      poll.month,
      poll.participants,
      confirmedDates,
      currentUrl,
      locale,
      poll.comments
    );

    navigator.clipboard.writeText(summary);
    setCopiedWhatsApp(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedWhatsApp(false);
    }, 3000);
  };

  const handleDownloadIcs = () => {
    if (confirmedDates.length === 0) {
      alert(t("scheduler.noQuorumDays"));
      return;
    }
    const icsString = generateIcsContent(poll.title, confirmedDates, locale);
    const filename = `dnd-${poll.slug}-sesiones.ics`;
    downloadIcsFile(filename, icsString);
  };

  const monthLabel = `${MONTH_NAMES[locale][poll.month - 1]} ${poll.year}`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Barra de Encabezado y Selector de Jugador */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Glow sutil ambiental */}
        <div
          className="absolute -right-20 -top-20 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, transparent 70%)",
          }}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl liquid-glass-subtle border border-white/15 flex items-center justify-center text-amber-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <Dices className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[11px] uppercase tracking-widest text-amber-400 font-bold">
                  {locale === "en" ? "D&D Campaign" : "Campaña D&D"}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
                  {poll.title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3.5 text-xs sm:text-sm text-zinc-400">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-200 liquid-glass-subtle px-3 py-1 rounded-full border border-white/10">
                <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
                {monthLabel}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-zinc-200 liquid-glass-subtle px-3 py-1 rounded-full border border-white/10">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                {totalParticipants} {locale === "en" ? "participants" : "participantes"}
              </span>
              <span className="text-zinc-500 hidden sm:inline">•</span>
              <span className="text-zinc-300 font-medium">
                ⏰ {locale === "en" ? "Time:" : "Horario:"} <strong className="text-zinc-100 font-bold">8:30 PM</strong>
              </span>
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0 liquid-glass-subtle px-3 py-1 rounded-full border border-white/10">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    isRealtimeConnected ? "text-emerald-400 animate-pulse" : "text-zinc-500"
                  }`}
                />
                <span className="text-xs font-medium text-zinc-300">
                  {isRealtimeConnected
                    ? locale === "en"
                      ? "Live"
                      : "En vivo"
                    : locale === "en"
                    ? "Connecting..."
                    : "Conectando..."}
                </span>
                {isUpdating && (
                  <span className="flex items-center gap-1 text-xs text-amber-300 font-bold ml-2 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {locale === "en" ? "Saving..." : "Guardando..."}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tarjeta de Identidad del Jugador / Modo Espectador */}
          <div className="relative liquid-glass-subtle rounded-3xl p-4 min-w-[280px] sm:min-w-[320px] border border-white/10 shadow-sm">
            <TutorialCallout
              stepId="room_claim"
              currentStepNumber={1}
              totalSteps={4}
              position="bottom"
              align="end"
              onNext={handleOpenClaimModal}
            />
            {selectedPlayer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    {locale === "en" ? "Your Personal Calendar" : "Tu Calendario Personal"}
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenClaimModal}
                    className="text-[11px] font-bold text-zinc-400 hover:text-amber-300 underline decoration-zinc-700 hover:decoration-amber-300 transition-colors active:scale-95"
                  >
                    {locale === "en" ? "Change" : "Cambiar"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 liquid-glass-subtle rounded-2xl px-3.5 py-2.5 border border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl ios-btn-amber text-zinc-950 font-black flex items-center justify-center text-sm shadow-md flex-shrink-0">
                      {selectedPlayer.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-sm font-black text-zinc-100 truncate block">
                        {selectedPlayer}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {playerMarkedDatesCount}{" "}
                        {locale === "en"
                          ? playerMarkedDatesCount === 1
                            ? "day marked"
                            : "days marked"
                          : playerMarkedDatesCount === 1
                          ? "día marcado"
                          : "días marcados"}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-0.5 rounded-full ios-btn-emerald text-white font-bold flex-shrink-0 shadow-sm">
                    {locale === "en" ? "Voting" : "Votando"}
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>
                    {locale === "en"
                      ? "Click any day to mark your availability."
                      : "Toca cualquier día para marcar tu disponibilidad."}
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-zinc-400" />
                    {locale === "en" ? "Spectator Mode" : "Modo Espectador"}
                  </span>
                </div>

                <div className="liquid-glass-subtle rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2.5 border border-white/10">
                  <div className="min-w-0 pr-1">
                    <p className="text-xs font-bold text-zinc-200 truncate">
                      {locale === "en" ? "View only" : "Solo visualización"}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {locale === "en" ? "Browse group availability" : "Consulta la disponibilidad general"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenClaimModal}
                    className="px-3.5 py-1.5 ios-btn-amber text-zinc-950 rounded-xl text-xs font-black transition-all shadow-sm flex-shrink-0 active:scale-95"
                  >
                    {locale === "en" ? "Claim character" : "Elegir personaje"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerta si ya hay fechas con 100% quórum */}
      {confirmedDates.length > 0 && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-xl shadow-xl shadow-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: "6s" }} />
            </div>
            <div>
              <h4 className="text-emerald-300 font-black text-sm sm:text-base flex items-center gap-2">
                ¡{confirmedDates.length}{" "}
                {confirmedDates.length === 1
                  ? locale === "en"
                    ? "date confirmed"
                    : "fecha confirmada"
                  : locale === "en"
                  ? "dates confirmed"
                  : "fechas confirmadas"}{" "}
                {locale === "en" ? "with 100% Quorum!" : "con Quórum Total (100%)!"}
              </h4>
              <div className="text-xs sm:text-sm text-emerald-200/80 mt-1">
                <span>
                  {locale === "en"
                    ? `All ${totalParticipants} members can play on: `
                    : `Todos los ${totalParticipants} miembros pueden jugar en: `}
                </span>
                <span className="inline-flex flex-wrap items-center gap-1.5 mt-1 sm:mt-0">
                  {confirmedDates.map((d) => (
                    <a
                      key={d}
                      href={generateGoogleCalendarUrl(poll.title, d, undefined, locale)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={locale === "en" ? "Click to add to Google Calendar" : "Clic para agendar esta fecha en Google Calendar"}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 font-bold text-xs transition-all hover:scale-105 active:scale-95"
                    >
                      <span>{formatFriendlyDate(d, locale)}</span>
                      <CalendarPlus className="w-3 h-3 text-emerald-300" />
                    </a>
                  ))}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyWhatsApp}
              className="flex-1 sm:flex-initial px-3.5 py-2 ios-btn-emerald text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedWhatsApp ? t("home.copied") : t("scheduler.whatsAppBtn")}
            </button>
            <button
              onClick={handleDownloadIcs}
              className="flex-1 sm:flex-initial px-3.5 py-2 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-white/15 active:scale-95"
              title={locale === "en" ? "Download .ics file" : "Descargar archivo .ics"}
            >
              <Download className="w-3.5 h-3.5" />
              {t("scheduler.downloadIcsBtn")}
            </button>
          </div>
        </div>
      )}

      {/* Calendario Mensual */}
      <div className="relative liquid-glass rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        <TutorialCallout
          stepId="room_vote"
          currentStepNumber={2}
          totalSteps={4}
          position="top"
          align="start"
        />

        {/* Cabecera del Calendario + Selector de Vista estilo iOS Segmented Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h2 className="text-lg sm:text-xl font-black text-zinc-100 flex items-center gap-2.5 tracking-tight">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
              <span>{t("scheduler.calendarTitle")}</span>
            </h2>

            {/* Selector de Vista en Mobile (Segmented Control estilo iOS) */}
            <div className="relative sm:hidden flex items-center gap-1 ios-segmented-control p-1 rounded-2xl">
              <TutorialCallout
                stepId="room_views"
                currentStepNumber={3}
                totalSteps={4}
                position="bottom"
                align="end"
              />
              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  completeStep("room_views");
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "list"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title={t("scheduler.viewAgenda")}
              >
                <List className="w-3.5 h-3.5" />
                <span>{t("scheduler.viewAgenda")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "grid"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title={t("scheduler.viewMonth")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t("scheduler.viewMonth")}</span>
              </button>
            </div>
          </div>

          {/* En desktop: Leyenda + Selector de Vista */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] inline-block" />
              <span className="font-medium">{t("scheduler.quorumLegend")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] inline-block" />
              <span className="font-medium">{t("scheduler.yourVoteLegend")}</span>
            </div>

            <div className="relative flex items-center gap-1 ios-segmented-control p-1 rounded-2xl ml-2">
              <TutorialCallout
                stepId="room_views"
                currentStepNumber={3}
                totalSteps={4}
                position="bottom"
                align="end"
              />
              <button
                type="button"
                onClick={() => {
                  setViewMode("grid");
                  completeStep("room_views");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "grid"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t("scheduler.viewMonth")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  completeStep("room_views");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "list"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>{t("scheduler.viewAgenda")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Si está en modo Lista: Filtros rápidos estilo iOS Pills */}
        {viewMode === "list" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => setListFilter("all")}
              className={`px-3.5 py-1.5 rounded-2xl font-bold whitespace-nowrap transition-all active:scale-95 ${
                listFilter === "all"
                  ? "ios-segmented-active"
                  : "liquid-glass-subtle text-zinc-400 hover:text-zinc-200 border border-white/[0.06]"
              }`}
            >
              {t("scheduler.filterUpcoming", { count: upcomingMonthDays.length })}
            </button>
            <button
              type="button"
              onClick={() => setListFilter("weekends")}
              className={`px-3.5 py-1.5 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 ${
                listFilter === "weekends"
                  ? "ios-segmented-active"
                  : "liquid-glass-subtle text-zinc-400 hover:text-zinc-200 border border-white/[0.06]"
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              <span>{t("scheduler.filterWeekends")}</span>
            </button>
            <button
              type="button"
              onClick={() => setListFilter("quorum")}
              className={`px-3.5 py-1.5 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 ${
                listFilter === "quorum"
                  ? "ios-segmented-active"
                  : "liquid-glass-subtle text-zinc-400 hover:text-zinc-200 border border-white/[0.06]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t("scheduler.filterWithVotes")}</span>
            </button>
          </div>
        )}

        {viewMode === "list" ? (
          /* ============================================================ */
          /* VISTA DE LISTA / AGENDA (Limitada a ~5 fechas con scroll)   */
          /* ============================================================ */
          <div>
            {filteredListDays.length === 0 ? (
              <div className="p-8 text-center liquid-glass-subtle rounded-3xl border border-white/10 text-zinc-400 text-sm backdrop-blur-md">
                No hay fechas próximas pendientes en este mes que coincidan con el filtro.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] sm:max-h-[490px] overflow-y-auto pr-1.5 sm:pr-2 overscroll-contain scroll-smooth">
                {filteredListDays.map((cellDay) => {
                  const dateKey = cellDay.dateString;
                  const voters = poll.availability[dateKey] || [];
                  const voterCount = voters.length;
                  const isQuorumReached = voterCount >= totalParticipants && totalParticipants > 0;
                  const isSelectedPlayerVoted = selectedPlayer ? voters.includes(selectedPlayer) : false;
                  const percentage = totalParticipants > 0 ? (voterCount / totalParticipants) * 100 : 0;
                  const dayOfWeek = cellDay.date.getDay();
                  const isWeekendOrFriday = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
                  const isToday = cellDay.dateString === todayDateStr;

                  return (
                    <div
                      key={dateKey}
                      className={`p-3.5 sm:p-4 rounded-3xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden ${
                        isQuorumReached
                          ? "bg-emerald-500/[0.14] border-emerald-400/60 shadow-[0_8px_24px_-4px_rgba(16,185,129,0.25)]"
                          : isSelectedPlayerVoted
                          ? "bg-amber-500/[0.14] border-amber-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
                          : "liquid-glass-subtle border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {/* Insignia de Fecha */}
                        <div
                          className={`w-12 h-12 sm:w-14 sm:h-14 p-1.5 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border shadow-sm ${
                            isQuorumReached
                              ? "ios-btn-emerald text-zinc-950 font-black shadow-md shadow-emerald-500/20"
                              : isSelectedPlayerVoted
                              ? "ios-btn-amber text-zinc-950 font-black shadow-md shadow-amber-500/20"
                              : isWeekendOrFriday
                              ? "liquid-glass-subtle text-amber-300 border-amber-400/30 font-bold"
                              : "liquid-glass-subtle text-zinc-400 border-white/10 font-medium"
                          }`}
                        >
                          <span className="text-[10px] uppercase font-black tracking-wider leading-tight">
                            {WEEKDAY_NAMES_SHORT[locale][dayOfWeek]}
                          </span>
                          <span className="text-lg sm:text-xl font-black leading-none mt-0.5">
                            {cellDay.dayNumber}
                          </span>
                        </div>

                        {/* Información de disponibilidad */}
                        <div className="min-w-0 space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-zinc-100 tracking-tight">
                              {formatFriendlyDate(dateKey, locale)}
                            </span>

                            {isToday && (
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full liquid-glass-subtle text-amber-300 border-amber-400/40 font-bold shadow-sm">
                                {t("scheduler.todayBadge")}
                              </span>
                            )}

                            {isQuorumReached ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold animate-pulse shadow-sm">
                                <Sparkles className="w-3 h-3" />
                                {t("scheduler.quorumReachedBadge", { voters: voterCount, total: totalParticipants })}
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                                  voterCount > 0
                                    ? "liquid-glass-subtle text-zinc-300 border-white/10"
                                    : "bg-black/20 text-zinc-500 border-white/[0.04]"
                                }`}
                              >
                                {t("scheduler.votersConfirmed", { voters: voterCount, total: totalParticipants })}
                              </span>
                            )}
                          </div>

                          {/* Barra de progreso visual */}
                          <div className="w-full max-w-xs h-1.5 bg-black/30 rounded-full overflow-hidden border border-white/[0.06]">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                isQuorumReached
                                  ? "bg-emerald-400"
                                  : voterCount > 0
                                  ? "bg-amber-400"
                                  : "bg-transparent"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          {/* Nombres directamente visibles */}
                          {voterCount > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] sm:text-[11px] text-zinc-400 font-medium">
                                {t("scheduler.availablePlayers")}
                              </span>
                              {voters.map((name) => (
                                <span
                                  key={name}
                                  className={`text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-xl border font-semibold ${
                                    name === selectedPlayer
                                      ? "bg-amber-500/20 text-amber-300 border-amber-400/40 font-bold"
                                      : "liquid-glass-subtle text-zinc-200 border-white/10"
                                  }`}
                                >
                                  ✓ {name}
                                </span>
                              ))}
                              {totalParticipants - voterCount > 0 && (
                                <span className="text-[10px] sm:text-[11px] text-zinc-500 ml-1">
                                  ({locale === "en" ? "Missing" : "Faltan"} {totalParticipants - voterCount})
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] text-zinc-500 italic">
                              {locale === "en"
                                ? "No one marked available yet."
                                : "Nadie ha marcado disponibilidad aún."}
                            </p>
                          )}
                          {/* Notas registradas en esta fecha */}
                          {(() => {
                            const dateNotes = (poll.comments && poll.comments[dateKey]) || [];
                            if (dateNotes.length === 0) return null;
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/[0.04]">
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{t("scheduler.dateNotesTitle")}:</span>
                                </span>
                                {dateNotes.map((note) => (
                                  <span
                                    key={note.id}
                                    className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-zinc-200"
                                  >
                                    <strong className="text-amber-300 font-bold">{note.author}:</strong>
                                    <span>&ldquo;{note.text}&rdquo;</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Botón de acción táctil estilo iOS */}
                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08] justify-end flex-shrink-0">
                        {selectedPlayer ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleDateAvailability(dateKey)}
                              className={`w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 ${
                                isSelectedPlayerVoted
                                  ? "ios-btn-emerald text-white shadow-emerald-950/40"
                                  : "liquid-glass-subtle hover:bg-white/[0.12] text-zinc-100 border border-white/15"
                              }`}
                            >
                              {isSelectedPlayerVoted ? (
                                <>
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  <span>{locale === "en" ? "Available" : "Disponible"}</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  <span>{locale === "en" ? "Mark available" : "Marcar disponible"}</span>
                                </>
                              )}
                            </button>

                            {/* Botón para abrir modal y añadir/editar nota si el día está marcado */}
                            {isSelectedPlayerVoted && (
                              <button
                                type="button"
                                onClick={() => setActiveDayModal(cellDay)}
                                title={t("scheduler.addNoteBtn")}
                                className="min-h-[44px] px-3.5 py-2 liquid-glass-subtle hover:bg-white/[0.12] text-amber-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-amber-400/30 active:scale-95 shadow-sm"
                              >
                                <MessageSquare className="w-4 h-4" />
                                <span className="hidden sm:inline">{t("scheduler.addNoteBtn")}</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveDayModal(cellDay)}
                            className="w-full sm:w-auto min-h-[44px] px-5 py-2 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/15 active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t("scheduler.seeDetail")}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredListDays.length > 5 && (
              <p className="text-[11px] text-zinc-400 text-center pt-3 flex items-center justify-center gap-1.5">
                <span>{t("scheduler.showingDates", { total: filteredListDays.length })}</span>
                <span>•</span>
                <span>{t("scheduler.scrollForMore")}</span>
              </p>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* VISTA DE CUADRÍCULA (Mes completo)                          */
          /* ============================================================ */
          <>
            {/* Encabezado Días de la semana */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {WEEKDAYS[locale].map((day, idx) => (
                <div
                  key={day}
                  className={`text-center py-2 text-xs font-bold uppercase tracking-wider ${
                    idx >= 5 ? "text-amber-400/80" : "text-zinc-400"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grilla de Días estilo iOS Liquid Glass */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {calendarDays.map((cellDay, index) => {
                const dateKey = cellDay.dateString;
                const voters = poll.availability[dateKey] || [];
                const voterCount = voters.length;
                const isQuorumReached = voterCount >= totalParticipants && totalParticipants > 0;
                const isSelectedPlayerVoted = selectedPlayer ? voters.includes(selectedPlayer) : false;
                const percentage = totalParticipants > 0 ? (voterCount / totalParticipants) * 100 : 0;
                const isPastDate = cellDay.dateString < todayDateStr;
                const colIndex = index % 7;

                let tooltipPositionClass = "left-1/2 -translate-x-1/2";
                let arrowPositionClass = "left-1/2 -translate-x-1/2";

                if (colIndex === 0) {
                  tooltipPositionClass = "left-0 translate-x-0";
                  arrowPositionClass = "left-6";
                } else if (colIndex === 6) {
                  tooltipPositionClass = "right-0 left-auto translate-x-0";
                  arrowPositionClass = "right-6";
                }

                if (!cellDay.isCurrentMonth) {
                  return (
                    <div
                      key={index}
                      className="min-h-[70px] sm:min-h-[110px] p-2 rounded-2xl bg-black/20 border border-white/[0.04] opacity-20 flex flex-col justify-between select-none"
                    >
                      <span className="text-xs text-zinc-600 font-medium">{cellDay.dayNumber}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={dateKey}
                    onClick={
                      isPastDate || !selectedPlayer
                        ? undefined
                        : () => toggleDateAvailability(dateKey)
                    }
                    onMouseEnter={() => setHoveredDay(cellDay)}
                    onMouseLeave={() => setHoveredDay(null)}
                    title={
                      isPastDate
                        ? t("scheduler.pastDateTitle")
                        : !selectedPlayer
                        ? undefined
                        : isSelectedPlayerVoted
                        ? t("scheduler.clickToUnmark")
                        : t("scheduler.clickToMark")
                    }
                    className={`group relative min-h-[72px] sm:min-h-[115px] p-2 sm:p-2.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between select-none ${
                      hoveredDay?.dateString === dateKey ? "z-40" : "z-10"
                    } ${
                      isPastDate
                        ? "bg-black/25 border-white/[0.04] opacity-35 cursor-not-allowed"
                        : !selectedPlayer
                        ? isQuorumReached
                          ? "bg-emerald-500/[0.14] border-emerald-400/70 cursor-default"
                          : "liquid-glass-subtle border-white/10 cursor-default"
                        : isQuorumReached
                        ? "bg-emerald-500/[0.16] border-emerald-400/70 hover:border-emerald-300 shadow-[0_4px_24px_-4px_rgba(16,185,129,0.35)] cursor-pointer active:scale-95"
                        : isSelectedPlayerVoted
                        ? "bg-amber-500/[0.14] border-amber-400/60 hover:border-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] cursor-pointer active:scale-95"
                        : "liquid-glass-subtle border-white/10 hover:border-white/20 hover:bg-white/[0.08] cursor-pointer active:scale-95"
                    }`}
                  >
                    {/* Cabecera de celda: Día + Checkbox de usuario */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-black tracking-tight ${
                          isPastDate
                            ? "text-zinc-600"
                            : isQuorumReached
                            ? "text-emerald-300"
                            : cellDay.isWeekend
                            ? "text-amber-300 font-extrabold"
                            : "text-zinc-200"
                        }`}
                      >
                        {cellDay.dayNumber}
                      </span>

                      {/* Indicador de si el día es pasado o si el jugador votó */}
                      {isPastDate ? (
                        <span className="text-[9px] sm:text-[10px] text-zinc-600 font-medium">{t("scheduler.pastDate")}</span>
                      ) : (
                        selectedPlayer && (
                          <span
                            title={
                              isSelectedPlayerVoted
                                ? t("scheduler.clickToUnmark")
                                : t("scheduler.clickToMark")
                            }
                            className={`w-4 h-4 rounded-lg flex items-center justify-center transition-all ${
                              isSelectedPlayerVoted
                                ? "ios-btn-amber text-zinc-950 shadow-sm"
                                : "border border-white/20 group-hover:border-white/40"
                            }`}
                          >
                            {isSelectedPlayerVoted && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                          </span>
                        )
                      )}
                    </div>

                    {/* Badge central de Quórum + Indicador de notas */}
                    <div className="my-auto py-0.5 sm:py-1 flex items-center justify-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDayModal(cellDay);
                        }}
                        title={locale === "en" ? "Click to see who voted on this day" : "Clic para ver quiénes votaron este día"}
                        className="cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                      >
                        {isQuorumReached ? (
                          <div className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full ios-btn-emerald text-white font-black text-[10px] sm:text-xs shadow-md shadow-emerald-500/30 animate-pulse">
                            <span>★</span>
                            <span>
                              {voterCount}/{totalParticipants}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full font-bold text-[10px] sm:text-xs transition-colors ${
                              voterCount > 0
                                ? "liquid-glass-subtle text-zinc-200 border border-white/15 hover:border-white/30 hover:bg-white/15"
                                : "bg-black/20 text-zinc-500 border border-white/[0.05] hover:border-white/20 hover:text-zinc-300"
                            }`}
                          >
                            {voterCount}/{totalParticipants}
                          </div>
                        )}
                      </button>

                      {/* Badge indicador de notas */}
                      {(() => {
                        const dateNotes = (poll.comments && poll.comments[dateKey]) || [];
                        if (dateNotes.length === 0) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDayModal(cellDay);
                            }}
                            title={
                              locale === "en"
                                ? `${dateNotes.length} note(s) on this date`
                                : `${dateNotes.length} nota(s) en esta fecha`
                            }
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-[9px] sm:text-[10px] font-bold transition-transform hover:scale-105 active:scale-95 shadow-sm"
                          >
                            <MessageSquare className="w-2.5 h-2.5" />
                            <span>{dateNotes.length}</span>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Mini Barra de progreso visual */}
                    <div className="w-full space-y-1">
                      <div className="w-full h-1 sm:h-1.5 bg-black/30 rounded-full overflow-hidden border border-white/[0.06]">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isQuorumReached
                              ? "bg-emerald-400"
                              : voterCount > 0
                              ? "bg-amber-400"
                              : "bg-transparent"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      {/* Votantes visibles en pantallas medianas */}
                      <div className="hidden sm:flex items-center gap-1 overflow-hidden text-[10px] text-zinc-400 truncate">
                        {voterCount > 0 ? (
                          <span className="truncate font-medium text-zinc-300">
                            {voters.slice(0, 2).join(", ")}
                            {voters.length > 2 && ` +${voters.length - 2}`}
                          </span>
                        ) : (
                          <span className="text-zinc-600 italic">{t("scheduler.noVotes")}</span>
                        )}
                      </div>
                    </div>

                    {/* Tooltip flotante al pasar el cursor */}
                    {hoveredDay?.dateString === dateKey && (
                      <div
                        className={`absolute bottom-full ${tooltipPositionClass} mb-2.5 z-50 w-60 sm:w-64 p-3.5 bg-[#0c0e14]/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] pointer-events-none text-left hidden sm:block border border-white/20`}
                      >
                        {/* Flecha indicadora apuntando a la celda */}
                        <div
                          className={`absolute -bottom-1.5 ${arrowPositionClass} w-3 h-3 bg-[#0c0e14] border-r border-b border-white/20 rotate-45 pointer-events-none`}
                        />

                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
                          <span className="text-xs font-black text-white tracking-wide">
                            {formatFriendlyDate(dateKey, locale)}
                          </span>
                          <span
                            className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                              isQuorumReached
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm shadow-emerald-500/20"
                                : voterCount > 0
                                ? "bg-white/10 text-zinc-200 border border-white/15"
                                : "bg-white/5 text-zinc-500 border border-white/[0.06]"
                            }`}
                          >
                            {voterCount}/{totalParticipants}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                              <span>{t("scheduler.confirmed", { count: voterCount })}</span>
                              {isQuorumReached && (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  {locale === "en" ? "★ 100% Quorum" : "★ Quórum 100%"}
                                </span>
                              )}
                            </div>
                            {voterCount > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {voters.map((name) => (
                                  <span
                                    key={name}
                                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                      name === selectedPlayer
                                        ? "bg-amber-500/25 text-amber-200 border-amber-400/50 shadow-sm"
                                        : "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                                    }`}
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-zinc-500 italic text-[11px]">{t("scheduler.noOneConfirmed")}</p>
                            )}
                          </div>

                          {totalParticipants - voterCount > 0 && (
                            <div className="pt-1 border-t border-white/[0.06]">
                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">
                                {t("scheduler.missing", { count: totalParticipants - voterCount })}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {poll.participants
                                  .filter((p) => !voters.includes(p))
                                  .map((name) => (
                                    <span
                                      key={name}
                                      className="px-2 py-0.5 rounded-lg bg-zinc-900/90 text-zinc-400 text-[11px] font-medium border border-white/[0.08]"
                                    >
                                      {name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Notas registradas en este día */}
                          {(() => {
                            const dateNotes = (poll.comments && poll.comments[dateKey]) || [];
                            if (dateNotes.length === 0) return null;
                            return (
                              <div className="pt-2 border-t border-white/[0.08] space-y-1">
                                <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{t("scheduler.dateNotesTitle")} ({dateNotes.length})</span>
                                </div>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {dateNotes.map((note) => (
                                    <div key={note.id} className="text-[11px] bg-white/5 rounded-lg p-1.5 border border-white/10">
                                      <span className="font-bold text-amber-300">{note.author}: </span>
                                      <span className="text-zinc-200">&ldquo;{note.text}&rdquo;</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Barra de Acciones de Exportación estilo iOS Liquid Glass */}
      <div className="relative liquid-glass rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <TutorialCallout
          stepId="room_export"
          currentStepNumber={4}
          totalSteps={4}
          position="top"
          align="start"
        />
        <div>
          <h3 className="text-base font-black text-zinc-100 flex items-center gap-2.5 tracking-tight">
            <Share2 className="w-4 h-4 text-amber-400" />
            {t("scheduler.exportTitle")}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t("scheduler.exportDesc")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón WhatsApp */}
          <button
            onClick={handleCopyWhatsApp}
            className="flex-1 sm:flex-initial px-4 py-2.5 ios-btn-emerald text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Copy className="w-4 h-4" />
            {copiedWhatsApp ? t("scheduler.whatsAppCopied") : t("scheduler.whatsAppBtn")}
          </button>

          {/* Botón Google Calendar: directo para 1 fecha o dropdown inteligente para múltiples fechas */}
          {confirmedDates.length === 0 ? (
            <button
              disabled
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/20 text-zinc-500 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-white/[0.04]"
              title={t("scheduler.googleCalDisabledTitle")}
            >
              <CalendarPlus className="w-4 h-4" />
              {t("scheduler.googleCalBtn")}
            </button>
          ) : confirmedDates.length === 1 ? (
            <a
              href={generateGoogleCalendarUrl(poll.title, confirmedDates[0], undefined, locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-4 py-2.5 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-100 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-white/15 active:scale-95 shadow-sm"
              title={t("scheduler.scheduleDate", { date: formatFriendlyDate(confirmedDates[0], locale) })}
            >
              <CalendarPlus className="w-4 h-4 text-blue-400" />
              <span>{t("scheduler.googleCalBtn")}</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          ) : (
            <div className="relative flex-1 sm:flex-initial" ref={googleDropdownRef}>
              <button
                type="button"
                onClick={() => setShowGoogleDropdown((prev) => !prev)}
                className="w-full px-4 py-2.5 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-100 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-white/15 active:scale-95 shadow-sm"
              >
                <CalendarPlus className="w-4 h-4 text-blue-400" />
                <span>{t("scheduler.googleCalCount", { count: confirmedDates.length })}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                    showGoogleDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showGoogleDropdown && (
                <div className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 z-40 w-72 sm:w-80 liquid-glass-elevated rounded-3xl shadow-2xl p-3.5 space-y-2 border border-white/20">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                    <span className="font-bold text-zinc-200">{t("scheduler.scheduleGoogleCalendar")}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-black text-[10px]">
                      {t("scheduler.datesCount", { count: confirmedDates.length })}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {confirmedDates.map((date) => (
                      <a
                        key={date}
                        href={generateGoogleCalendarUrl(poll.title, date, undefined, locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowGoogleDropdown(false)}
                        className="flex items-center justify-between p-2.5 rounded-2xl liquid-glass-subtle hover:bg-white/[0.12] border border-white/10 hover:border-blue-400/50 transition-all text-xs text-zinc-200 group active:scale-95"
                      >
                        <span className="font-bold text-zinc-200 group-hover:text-white">
                          {formatFriendlyDate(date, locale)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-bold">
                          {t("scheduler.openExternal")} <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        confirmedDates.forEach((date) => {
                          window.open(generateGoogleCalendarUrl(poll.title, date, undefined, locale), "_blank");
                        });
                        setShowGoogleDropdown(false);
                      }}
                      className="w-full py-2 px-3.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-400/30 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      {t("scheduler.openAllTabs")}
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center leading-tight">
                      {t("scheduler.icsTipBefore")}
                      <strong className="text-zinc-200">{t("scheduler.icsTipStrong")}</strong>
                      {t("scheduler.icsTipAfter")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón iCalendar (.ics) */}
          <button
            onClick={handleDownloadIcs}
            disabled={confirmedDates.length === 0}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border ${
              confirmedDates.length > 0
                ? "liquid-glass-subtle hover:bg-white/[0.12] text-zinc-100 border-white/15 active:scale-95"
                : "bg-black/20 text-zinc-500 border-white/[0.04] cursor-not-allowed"
            }`}
          >
            <Download className="w-4 h-4" />
            {t("scheduler.downloadIcsBtn")}
          </button>
        </div>
      </div>

      {/* Modal de Detalle de Día estilo iOS Sheet */}
      {activeDayModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveDayModal(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xl animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md liquid-glass-elevated rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 cursor-default overflow-hidden"
          >
            {/* iOS Sheet Grab Indicator */}
            <div className="w-10 h-1 bg-white/25 rounded-full mx-auto -mt-1 mb-2" />

            <button
              onClick={() => setActiveDayModal(null)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-2xl hover:bg-white/10 transition-colors"
              title={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                {t("scheduler.dayDetailHeader")}
              </div>
              <h3 className="text-xl font-black text-zinc-100 tracking-tight mt-1">
                {formatFriendlyDate(activeDayModal.dateString, locale)}
              </h3>
            </div>

            {/* Votantes */}
            {(() => {
              const voters = poll.availability[activeDayModal.dateString] || [];
              const voterCount = voters.length;
              const isQuorum = voterCount >= totalParticipants && totalParticipants > 0;
              const missingPlayers = poll.participants.filter((p) => !voters.includes(p));

              return (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl liquid-glass-subtle border border-white/10">
                    <span className="font-semibold text-zinc-300">{t("scheduler.tableQuorum")}</span>
                    <span
                      className={`font-black px-3 py-1 rounded-full ${
                        isQuorum
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm"
                          : "liquid-glass-subtle text-zinc-400 border border-white/10"
                      }`}
                    >
                      {t("scheduler.quorumStatus", {
                        voters: voterCount,
                        total: totalParticipants,
                        percent: Math.round((voterCount / (totalParticipants || 1)) * 100),
                      })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider block text-[10px]">
                      {t("scheduler.availableVoters", { count: voterCount })}
                    </span>
                    {voterCount > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {voters.map((name) => (
                          <span
                            key={name}
                            className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-bold"
                          >
                            ✓ {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 italic">{t("scheduler.noOneConfirmed")}</p>
                    )}
                  </div>

                  {missingPlayers.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="font-bold text-zinc-500 uppercase tracking-wider block text-[10px]">
                        {t("scheduler.missingVoters", { count: missingPlayers.length })}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missingPlayers.map((name) => (
                          <span
                            key={name}
                            className="px-3 py-1 rounded-xl liquid-glass-subtle border border-white/10 text-zinc-400 font-semibold"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sección: Notas de la fecha */}
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-300 uppercase tracking-wider block text-[10px] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t("scheduler.dateNotesTitle")}</span>
                      </span>
                      {(() => {
                        const dateNotes = (poll.comments && poll.comments[activeDayModal.dateString]) || [];
                        if (dateNotes.length === 0) return null;
                        return (
                          <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20">
                            {dateNotes.length === 1
                              ? t("scheduler.oneNoteBadge")
                              : t("scheduler.notesCountBadge", { count: dateNotes.length })}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Lista de notas existentes */}
                    {(() => {
                      const dateNotes = (poll.comments && poll.comments[activeDayModal.dateString]) || [];
                      if (dateNotes.length === 0) {
                        return (
                          <p className="text-zinc-500 italic text-xs py-1">
                            {t("scheduler.noDateNotes")}
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                          {dateNotes.map((note) => {
                            const isMyNote = selectedPlayer === note.author;
                            return (
                              <div
                                key={note.id}
                                className={`p-2.5 rounded-2xl border text-xs space-y-1 transition-colors ${
                                  isMyNote
                                    ? "bg-amber-500/10 border-amber-400/30 text-zinc-100"
                                    : "liquid-glass-subtle border-white/10 text-zinc-300"
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`font-black ${
                                        isMyNote ? "text-amber-300" : "text-zinc-200"
                                      }`}
                                    >
                                      {note.author}
                                    </span>
                                    {isMyNote && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 font-bold text-[9px]">
                                        {locale === "en" ? "You" : "Tú"}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-zinc-500 text-[10px]">
                                      {formatCommentTime(note.createdAt, locale)}
                                    </span>
                                    {isMyNote && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCommentInput(note.text);
                                            setIsEditingComment(true);
                                          }}
                                          title={t("scheduler.editNoteBtn")}
                                          className="p-1 hover:text-amber-300 text-zinc-400 transition-colors"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteComment(activeDayModal.dateString, note.id)}
                                          title={t("scheduler.deleteNoteBtn")}
                                          className="p-1 hover:text-red-400 text-zinc-400 transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-zinc-200 text-xs leading-relaxed break-words font-medium">
                                  &ldquo;{note.text}&rdquo;
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Formulario para agregar / editar nota */}
                    {selectedPlayer && voters.includes(selectedPlayer) && activeDayModal.dateString >= todayDateStr ? (
                      <div className="pt-2 space-y-2">
                        <div className="relative">
                          <textarea
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value.slice(0, 140))}
                            placeholder={t("scheduler.notePlaceholder")}
                            maxLength={140}
                            rows={2}
                            className="w-full text-xs p-3 rounded-2xl bg-black/40 border border-white/15 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 resize-none transition-colors"
                          />
                          <div className="absolute right-2.5 bottom-2 text-[10px] font-medium text-zinc-500 pointer-events-none">
                            {commentInput.length}/140
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {isEditingComment && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingComment(false);
                                const currentComments = poll.comments?.[activeDayModal.dateString] || [];
                                const existing = currentComments.find((c) => c.author === selectedPlayer);
                                setCommentInput(existing ? existing.text : "");
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white liquid-glass-subtle border border-white/10 transition-colors"
                            >
                              {t("scheduler.cancelNoteBtn")}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!commentInput.trim() || isSavingComment}
                            onClick={() => handleSaveComment(activeDayModal.dateString, commentInput)}
                            className="px-4 py-1.5 rounded-xl text-xs font-black ios-btn-amber text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1.5"
                          >
                            {isSavingComment && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>{t("scheduler.saveNoteBtn")}</span>
                          </button>
                        </div>
                      </div>
                    ) : selectedPlayer && !voters.includes(selectedPlayer) && activeDayModal.dateString >= todayDateStr ? (
                      <p className="text-[11px] text-zinc-500 italic bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.05]">
                        💡 {t("scheduler.onlyVotersCanNote")}
                      </p>
                    ) : null}
                  </div>

                  {/* Si el usuario tiene personaje seleccionado y el día no ha pasado, botón directo de votar */}
                  {selectedPlayer && activeDayModal.dateString >= todayDateStr && (
                    <div className="pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          toggleDateAvailability(activeDayModal.dateString);
                        }}
                        className={`w-full py-3 px-4 rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 ${
                          voters.includes(selectedPlayer)
                            ? "bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-200"
                            : "ios-btn-amber text-zinc-950"
                        }`}
                      >
                        {voters.includes(selectedPlayer) ? (
                          <>
                            <X className="w-4 h-4" />
                            {t("scheduler.removeMyAvailability")}
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            {t("scheduler.markMeAvailable")}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Toast rápido al marcar disponibilidad: "Añadir nota" */}
      {quickNoteDate && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl liquid-glass-elevated border border-amber-400/40 shadow-2xl animate-in slide-in-from-bottom-5">
          <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-zinc-200">
            {t("scheduler.quickNoteToast")} (<strong>{formatFriendlyDate(quickNoteDate, locale)}</strong>)
          </span>
          <button
            type="button"
            onClick={() => {
              const day = calendarDays.find((d) => d.dateString === quickNoteDate);
              if (day) {
                setActiveDayModal(day);
              }
              setQuickNoteDate(null);
            }}
            className="px-3 py-1 text-xs font-bold rounded-xl ios-btn-amber text-zinc-950 shadow-sm transition-all active:scale-95"
          >
            {t("scheduler.addNoteBtn")}
          </button>
          <button
            type="button"
            onClick={() => setQuickNoteDate(null)}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modal de Reclamo de Personaje */}
      <ClaimCharacterModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        campaignTitle={poll.title}
        participants={poll.participants}
        availability={poll.availability}
        currentSelectedPlayer={selectedPlayer}
        onSelectPlayer={handleClaimPlayer}
        onEnterAsSpectator={handleEnterAsSpectator}
        canDismiss={Boolean(selectedPlayer || isSpectator)}
      />
    </div>
  );
}
