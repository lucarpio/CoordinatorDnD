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
} from "lucide-react";
import { Poll, AvailabilityMap } from "@/lib/supabase";
import ClaimCharacterModal from "@/components/ClaimCharacterModal";
import { saveCreatedPoll } from "@/lib/storage";
import {
  getMonthDays,
  MONTH_NAMES_ES,
  WEEKDAYS_ES,
  formatFriendlyDate,
  formatDateKey,
  generateWhatsAppSummary,
  generateGoogleCalendarUrl,
  generateIcsContent,
  downloadIcsFile,
  CalendarDay,
} from "@/lib/calendarUtils";

const WEEKDAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface MonthSchedulerProps {
  initialPoll: Poll;
  onUpdateAvailability: (newAvailability: AvailabilityMap) => Promise<boolean>;
  isRealtimeConnected: boolean;
}

export default function MonthScheduler({
  initialPoll,
  onUpdateAvailability,
  isRealtimeConnected,
}: MonthSchedulerProps) {
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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<AvailabilityMap | null>(null);
  const selectedPlayerRef = useRef<string>(selectedPlayer);

  useEffect(() => {
    selectedPlayerRef.current = selectedPlayer;
  }, [selectedPlayer]);

  // Sincronizar estado local con props entrantes (Realtime)
  useEffect(() => {
    // Si tenemos clics pendientes de guardar o se están guardando localmente,
    // fusionamos para preservar la selección activa del jugador actual sin que se borren
    if (debounceTimerRef.current !== null || isSavingRef.current || pendingSaveRef.current !== null) {
      const currentPlayer = selectedPlayerRef.current;
      if (currentPlayer) {
        const merged: AvailabilityMap = { ...initialPoll.availability };
        const allDates = new Set([
          ...Object.keys(availabilityRef.current),
          ...Object.keys(merged),
        ]);

        allDates.forEach((date) => {
          const localVoters = availabilityRef.current[date] || [];
          const remoteVoters = merged[date] || [];
          const localHasPlayer = localVoters.includes(currentPlayer);
          const remoteHasPlayer = remoteVoters.includes(currentPlayer);

          if (localHasPlayer && !remoteHasPlayer) {
            merged[date] = [...remoteVoters, currentPlayer];
          } else if (!localHasPlayer && remoteHasPlayer) {
            merged[date] = remoteVoters.filter((p) => p !== currentPlayer);
          }
        });

        availabilityRef.current = merged;
        setPoll((prev) => ({ ...initialPoll, availability: merged }));
        return;
      }
    }

    availabilityRef.current = initialPoll.availability;
    setPoll(initialPoll);
  }, [initialPoll]);

  // Limpiar timer de debounce al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Recordar al jugador en localStorage o invitar a reclamar personaje
  useEffect(() => {
    const storageKey = `dnd_player_${poll.slug}`;
    const savedPlayer = localStorage.getItem(storageKey);
    if (savedPlayer && poll.participants.includes(savedPlayer)) {
      setSelectedPlayer(savedPlayer);
    } else {
      const isSpectatorSession = sessionStorage.getItem(`dnd_spectator_${poll.slug}`);
      if (isSpectatorSession) {
        setIsSpectator(true);
      } else {
        setShowClaimModal(true);
      }
    }
  }, [poll.slug, poll.participants]);

  const handleClaimPlayer = (player: string) => {
    setSelectedPlayer(player);
    setIsSpectator(false);
    setShowClaimModal(false);
    localStorage.setItem(`dnd_player_${poll.slug}`, player);
    sessionStorage.removeItem(`dnd_spectator_${poll.slug}`);

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
  };

  const handleEnterAsSpectator = () => {
    setSelectedPlayer("");
    setIsSpectator(true);
    setShowClaimModal(false);
    sessionStorage.setItem(`dnd_spectator_${poll.slug}`, "true");
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
      await onUpdateAvailability(dataToSave);
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        await flushPendingSave();
      } else {
        setIsUpdating(false);
      }
    }
  }, [onUpdateAvailability]);

  const triggerDebouncedSave = useCallback((newAvailability: AvailabilityMap) => {
    pendingSaveRef.current = newAvailability;
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

    // 2. Actualizamos el estado de React inmediatamente para respuesta visual instantánea
    setPoll((prev) => ({
      ...prev,
      availability: nextAvailability,
    }));

    // 3. Celebración con confeti si con este voto se alcanza el 100% de quórum
    if (!isCurrentlyAvailable && updatedVoters.length === totalParticipants && totalParticipants > 0) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#10b981", "#34d399", "#d4af37", "#f59e0b", "#6366f1"],
      });
    }

    // 4. Guardado debounced (agrupa clics seguidos en una sola petición)
    triggerDebouncedSave(nextAvailability);
  };


  const handleCopyWhatsApp = () => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    const summary = generateWhatsAppSummary(
      poll.title,
      poll.year,
      poll.month,
      poll.participants,
      confirmedDates,
      currentUrl
    );

    navigator.clipboard.writeText(summary);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  const handleDownloadIcs = () => {
    if (confirmedDates.length === 0) {
      alert("Aún no hay fechas confirmadas con el 100% de quórum para exportar.");
      return;
    }
    const icsString = generateIcsContent(poll.title, confirmedDates);
    const filename = `dnd-${poll.slug}-sesiones.ics`;
    downloadIcsFile(filename, icsString);
  };

  const monthLabel = `${MONTH_NAMES_ES[poll.month - 1]} ${poll.year}`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Barra de Encabezado y Selector de Jugador */}
      <div className="liquid-glass rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Glow sutil ambiental */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl liquid-glass-subtle border border-white/15 flex items-center justify-center text-amber-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <Dices className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[11px] uppercase tracking-widest text-amber-400 font-bold">
                  Campaña D&D
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
                {totalParticipants} participantes
              </span>
              <span className="text-zinc-500 hidden sm:inline">•</span>
              <span className="text-zinc-300 font-medium">
                ⏰ Horario: <strong className="text-zinc-100 font-bold">8:30 PM</strong>
              </span>
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0 liquid-glass-subtle px-3 py-1 rounded-full border border-white/10">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    isRealtimeConnected ? "text-emerald-400 animate-pulse" : "text-zinc-500"
                  }`}
                />
                <span className="text-xs font-medium text-zinc-300">
                  {isRealtimeConnected ? "En vivo" : "Conectando..."}
                </span>
                {isUpdating && (
                  <span className="flex items-center gap-1 text-xs text-amber-300 font-bold ml-2 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Guardando...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tarjeta de Identidad del Jugador / Modo Espectador */}
          <div className="liquid-glass-subtle rounded-3xl p-4 min-w-[280px] sm:min-w-[320px] border border-white/10 shadow-sm">
            {selectedPlayer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    Tu Calendario Personal
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenClaimModal}
                    className="text-[11px] font-bold text-zinc-400 hover:text-amber-300 underline decoration-zinc-700 hover:decoration-amber-300 transition-colors active:scale-95"
                  >
                    Cambiar
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
                        {playerMarkedDatesCount} {playerMarkedDatesCount === 1 ? "día marcado" : "días marcados"}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-0.5 rounded-full ios-btn-emerald text-white font-bold flex-shrink-0 shadow-sm">
                    Votando
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Toca cualquier día para marcar tu disponibilidad.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-zinc-400" />
                    Modo Espectador
                  </span>
                </div>

                <div className="liquid-glass-subtle rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2.5 border border-white/10">
                  <div className="min-w-0 pr-1">
                    <p className="text-xs font-bold text-zinc-200 truncate">Solo visualización</p>
                    <p className="text-[10px] text-zinc-400 truncate">Consulta la disponibilidad general</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenClaimModal}
                    className="px-3.5 py-1.5 ios-btn-amber text-zinc-950 rounded-xl text-xs font-black transition-all shadow-sm flex-shrink-0 active:scale-95"
                  >
                    Elegir personaje
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
                {confirmedDates.length === 1 ? "fecha confirmada" : "fechas confirmadas"} con Quórum
                Total (100%)!
              </h4>
              <div className="text-xs sm:text-sm text-emerald-200/80 mt-1">
                <span>Todos los {totalParticipants} miembros pueden jugar en: </span>
                <span className="inline-flex flex-wrap items-center gap-1.5 mt-1 sm:mt-0">
                  {confirmedDates.map((d) => (
                    <a
                      key={d}
                      href={generateGoogleCalendarUrl(poll.title, d)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Clic para agendar esta fecha en Google Calendar"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 font-bold text-xs transition-all hover:scale-105 active:scale-95"
                    >
                      <span>{formatFriendlyDate(d)}</span>
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
              {copiedWhatsApp ? "¡Copiado!" : "Copiar para WhatsApp"}
            </button>
            <button
              onClick={handleDownloadIcs}
              className="flex-1 sm:flex-initial px-3.5 py-2 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-white/15 active:scale-95"
              title="Descargar archivo .ics"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar .ics
            </button>
          </div>
        </div>
      )}

      {/* Calendario Mensual */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        {/* Cabecera del Calendario + Selector de Vista estilo iOS Segmented Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h2 className="text-lg sm:text-xl font-black text-zinc-100 flex items-center gap-2.5 tracking-tight">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
              <span>Calendario de Disponibilidad</span>
            </h2>

            {/* Selector de Vista en Mobile (Segmented Control estilo iOS) */}
            <div className="sm:hidden flex items-center gap-1 ios-segmented-control p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "list"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Vista Lista / Agenda"
              >
                <List className="w-3.5 h-3.5" />
                <span>Agenda</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "grid"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Vista Cuadrícula (Mes)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mes</span>
              </button>
            </div>
          </div>

          {/* En desktop: Leyenda + Selector de Vista */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] inline-block" />
              <span className="font-medium">100% Quórum</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] inline-block" />
              <span className="font-medium">Tu voto</span>
            </div>

            <div className="flex items-center gap-1 ios-segmented-control p-1 rounded-2xl ml-2">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "grid"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mes</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewMode === "list"
                    ? "ios-segmented-active"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Agenda</span>
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
              Próximas fechas ({upcomingMonthDays.length})
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
              <span>Fines de Semana (Vie-Dom)</span>
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
              <span>Con respuestas</span>
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
                            {WEEKDAY_NAMES_SHORT[dayOfWeek]}
                          </span>
                          <span className="text-lg sm:text-xl font-black leading-none mt-0.5">
                            {cellDay.dayNumber}
                          </span>
                        </div>

                        {/* Información de disponibilidad */}
                        <div className="min-w-0 space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-zinc-100 tracking-tight">
                              {formatFriendlyDate(dateKey)}
                            </span>

                            {isToday && (
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full liquid-glass-subtle text-amber-300 border-amber-400/40 font-bold shadow-sm">
                                Hoy
                              </span>
                            )}

                            {isQuorumReached ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold animate-pulse shadow-sm">
                                <Sparkles className="w-3 h-3" />
                                ★ ¡100% Quórum! ({voterCount}/{totalParticipants})
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                                  voterCount > 0
                                    ? "liquid-glass-subtle text-zinc-300 border-white/10"
                                    : "bg-black/20 text-zinc-500 border-white/[0.04]"
                                }`}
                              >
                                {voterCount}/{totalParticipants} confirmados
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
                                Disponibles:
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
                                  (Faltan {totalParticipants - voterCount})
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] text-zinc-500 italic">
                              Nadie ha marcado disponibilidad aún.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botón de acción táctil estilo iOS */}
                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08] justify-end flex-shrink-0">
                        {selectedPlayer ? (
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
                                <span>Disponible</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                <span>Marcar disponible</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveDayModal(cellDay)}
                            className="w-full sm:w-auto min-h-[44px] px-5 py-2 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/15 active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver detalle</span>
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
                <span>Mostrando 5 de {filteredListDays.length} fechas próximas</span>
                <span>•</span>
                <span>Desliza para ver más</span>
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
              {WEEKDAYS_ES.map((day, idx) => (
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
                        ? "Esta fecha ya pasó (no disponible para coordinar)"
                        : !selectedPlayer
                        ? undefined
                        : isSelectedPlayerVoted
                        ? "Clic para desmarcar tu disponibilidad"
                        : "Clic para marcar tu disponibilidad"
                    }
                    className={`group relative min-h-[72px] sm:min-h-[115px] p-2 sm:p-2.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between select-none ${
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
                        <span className="text-[9px] sm:text-[10px] text-zinc-600 font-medium">Pasado</span>
                      ) : (
                        selectedPlayer && (
                          <span
                            title={
                              isSelectedPlayerVoted
                                ? "Marcaste disponible este día (clic para quitar)"
                                : "No has marcado este día (clic para marcar)"
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

                    {/* Badge central de Quórum (ÚNICO elemento que abre el modal de detalle de asistencia) */}
                    <div className="my-auto py-0.5 sm:py-1 flex justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDayModal(cellDay);
                        }}
                        title="Clic para ver quiénes votaron este día"
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
                          <span className="text-zinc-600 italic">Sin votos</span>
                        )}
                      </div>
                    </div>

                    {/* Tooltip flotante al pasar el cursor */}
                    {hoveredDay?.dateString === dateKey && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-56 p-3.5 liquid-glass-elevated rounded-2xl shadow-2xl pointer-events-none text-left hidden sm:block border border-white/15">
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                          <span className="text-xs font-black text-zinc-100">
                            {formatFriendlyDate(dateKey)}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isQuorumReached
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                                : "liquid-glass-subtle text-zinc-300"
                            }`}
                          >
                            {voterCount}/{totalParticipants}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            Confirmados ({voterCount}):
                          </div>
                          {voterCount > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {voters.map((name) => (
                                <span
                                  key={name}
                                  className="px-2 py-0.5 rounded-lg liquid-glass-subtle text-zinc-200 text-[11px] border border-white/10"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-zinc-500 italic text-[11px]">Nadie ha confirmado aún.</p>
                          )}

                          {totalParticipants - voterCount > 0 && (
                            <>
                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pt-1">
                                Faltan ({totalParticipants - voterCount}):
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {poll.participants
                                  .filter((p) => !voters.includes(p))
                                  .map((name) => (
                                    <span
                                      key={name}
                                      className="px-2 py-0.5 rounded-lg bg-black/30 text-zinc-500 text-[11px] border border-white/[0.04]"
                                    >
                                      {name}
                                    </span>
                                  ))}
                              </div>
                            </>
                          )}
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
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-zinc-100 flex items-center gap-2.5 tracking-tight">
            <Share2 className="w-4 h-4 text-amber-400" />
            Exportar y Notificar al Grupo
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Comparte los resultados por WhatsApp o agenda las sesiones en tu calendario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón WhatsApp */}
          <button
            onClick={handleCopyWhatsApp}
            className="flex-1 sm:flex-initial px-4 py-2.5 ios-btn-emerald text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Copy className="w-4 h-4" />
            {copiedWhatsApp ? "¡Resumen Copiado!" : "Copiar para WhatsApp"}
          </button>

          {/* Botón Google Calendar: directo para 1 fecha o dropdown inteligente para múltiples fechas */}
          {confirmedDates.length === 0 ? (
            <button
              disabled
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/20 text-zinc-500 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-white/[0.04]"
              title="Disponible cuando haya al menos 1 fecha con quórum 100%"
            >
              <CalendarPlus className="w-4 h-4" />
              Google Calendar
            </button>
          ) : confirmedDates.length === 1 ? (
            <a
              href={generateGoogleCalendarUrl(poll.title, confirmedDates[0])}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-4 py-2.5 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-100 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-white/15 active:scale-95 shadow-sm"
              title={`Agendar ${formatFriendlyDate(confirmedDates[0])}`}
            >
              <CalendarPlus className="w-4 h-4 text-blue-400" />
              <span>Google Calendar</span>
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
                <span>Google Calendar ({confirmedDates.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                    showGoogleDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showGoogleDropdown && (
                <div className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 z-40 w-72 sm:w-80 liquid-glass-elevated rounded-3xl shadow-2xl p-3.5 space-y-2 border border-white/20">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                    <span className="font-bold text-zinc-200">Agendar en Google Calendar:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-black text-[10px]">
                      {confirmedDates.length} fechas
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {confirmedDates.map((date) => (
                      <a
                        key={date}
                        href={generateGoogleCalendarUrl(poll.title, date)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowGoogleDropdown(false)}
                        className="flex items-center justify-between p-2.5 rounded-2xl liquid-glass-subtle hover:bg-white/[0.12] border border-white/10 hover:border-blue-400/50 transition-all text-xs text-zinc-200 group active:scale-95"
                      >
                        <span className="font-bold text-zinc-200 group-hover:text-white">
                          {formatFriendlyDate(date)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-bold">
                          Abrir <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        confirmedDates.forEach((date) => {
                          window.open(generateGoogleCalendarUrl(poll.title, date), "_blank");
                        });
                        setShowGoogleDropdown(false);
                      }}
                      className="w-full py-2 px-3.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-400/30 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Abrir todas las fechas en pestañas
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center leading-tight">
                      💡 Usa <strong className="text-zinc-200">&quot;Descargar .ics&quot;</strong> si prefieres importar todas juntas en 1 archivo.
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
            Descargar .ics
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
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Detalle de Disponibilidad
              </div>
              <h3 className="text-xl font-black text-zinc-100 tracking-tight mt-1">
                {formatFriendlyDate(activeDayModal.dateString)}
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
                    <span className="font-semibold text-zinc-300">Quórum de la mesa:</span>
                    <span
                      className={`font-black px-3 py-1 rounded-full ${
                        isQuorum
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm"
                          : "liquid-glass-subtle text-zinc-400 border border-white/10"
                      }`}
                    >
                      {voterCount} de {totalParticipants} confirmados ({Math.round((voterCount / (totalParticipants || 1)) * 100)}%)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider block text-[10px]">
                      Disponibles ({voterCount}):
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
                      <p className="text-zinc-500 italic">Nadie ha marcado disponible aún.</p>
                    )}
                  </div>

                  {missingPlayers.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="font-bold text-zinc-500 uppercase tracking-wider block text-[10px]">
                        Faltan por confirmar ({missingPlayers.length}):
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
                            Quitar mi disponibilidad
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            Marcarme como disponible
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
