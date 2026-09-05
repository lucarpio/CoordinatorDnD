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
  const googleDropdownRef = useRef<HTMLDivElement>(null);

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

  const calendarDays = useMemo(() => {
    return getMonthDays(poll.year, poll.month);
  }, [poll.year, poll.month]);

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

  const todayDateStr = formatDateKey(new Date());

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
      <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Glow sutil */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <Dices className="w-6 h-6" />
              </span>
              <div>
                <span className="text-xs uppercase tracking-widest text-amber-400/90 font-semibold">
                  Campaña D&D
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
                  {poll.title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs sm:text-sm text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <CalendarIcon className="w-4 h-4 text-amber-400" />
                {monthLabel}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Users className="w-4 h-4 text-amber-400" />
                {totalParticipants} participantes
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400 font-medium">
                ⏰ Horario: <strong className="text-zinc-200">8:30 PM</strong>
              </span>
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    isRealtimeConnected ? "text-emerald-400 animate-pulse" : "text-zinc-500"
                  }`}
                />
                <span className="text-xs text-zinc-400">
                  {isRealtimeConnected ? "En vivo" : "Conectando..."}
                </span>
                {isUpdating && (
                  <span className="flex items-center gap-1 text-xs text-amber-400 font-medium ml-2 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Guardando...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tarjeta de Identidad del Jugador / Modo Espectador */}
          <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-3.5 sm:p-4 min-w-[280px] sm:min-w-[320px] shadow-lg">
            {selectedPlayer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    Tu Calendario Personal
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenClaimModal}
                    className="text-[11px] font-semibold text-zinc-400 hover:text-amber-400 underline decoration-zinc-700 hover:decoration-amber-400 transition-colors"
                  >
                    Cambiar
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 bg-zinc-900/90 border border-zinc-800/80 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-zinc-950 font-black flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                      {selectedPlayer.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-sm font-extrabold text-zinc-100 truncate block">
                        {selectedPlayer}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {playerMarkedDatesCount} {playerMarkedDatesCount === 1 ? "día marcado" : "días marcados"}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex-shrink-0">
                    Votando
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 flex items-center gap-1 pt-0.5">
                  <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
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

                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 pr-1">
                    <p className="text-xs font-semibold text-zinc-200 truncate">Solo visualización</p>
                    <p className="text-[10px] text-zinc-500 truncate">Consulta la disponibilidad general</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenClaimModal}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs font-bold transition-all shadow-md flex-shrink-0 active:scale-95"
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
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-sm shadow-lg shadow-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: "6s" }} />
            </div>
            <div>
              <h4 className="text-emerald-300 font-bold text-sm sm:text-base flex items-center gap-2">
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
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-500/40 text-emerald-100 font-semibold text-xs transition-all hover:scale-105"
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
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedWhatsApp ? "¡Copiado!" : "Copiar para WhatsApp"}
            </button>
            <button
              onClick={handleDownloadIcs}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-zinc-700"
              title="Descargar archivo .ics"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar .ics
            </button>
          </div>
        </div>
      )}

      {/* Calendario Mensual */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-100 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-amber-400" />
            Calendario de Disponibilidad
          </h2>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500 inline-block" />
              <span>100% Quórum</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500 inline-block" />
              <span>Tu voto</span>
            </div>
          </div>
        </div>

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

        {/* Grilla de Días */}
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
                  className="min-h-[85px] sm:min-h-[110px] p-2 rounded-xl bg-zinc-950/30 border border-zinc-900/50 opacity-25 flex flex-col justify-between select-none"
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
                className={`group relative min-h-[90px] sm:min-h-[115px] p-2 sm:p-2.5 rounded-xl border transition-all duration-200 flex flex-col justify-between select-none ${
                  isPastDate
                    ? "bg-zinc-950/30 border-zinc-900/80 opacity-40 cursor-not-allowed"
                    : !selectedPlayer
                    ? isQuorumReached
                      ? "bg-emerald-950/40 border-emerald-500/80 cursor-default"
                      : "bg-zinc-950/70 border-zinc-800 cursor-default"
                    : isQuorumReached
                    ? "bg-emerald-950/50 border-emerald-500 hover:border-emerald-400 shadow-lg shadow-emerald-950/30 hover:shadow-emerald-900/50 cursor-pointer"
                    : isSelectedPlayerVoted
                    ? "bg-amber-950/30 border-amber-500/60 hover:border-amber-400 cursor-pointer"
                    : "bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40 cursor-pointer"
                }`}
              >
                {/* Cabecera de celda: Día + Checkbox de usuario */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      isPastDate
                        ? "text-zinc-600"
                        : isQuorumReached
                        ? "text-emerald-300"
                        : cellDay.isWeekend
                        ? "text-amber-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {cellDay.dayNumber}
                  </span>

                  {/* Indicador de si el día es pasado o si el jugador votó */}
                  {isPastDate ? (
                    <span className="text-[10px] text-zinc-600 font-medium">Pasado</span>
                  ) : (
                    selectedPlayer && (
                      <span
                        title={
                          isSelectedPlayerVoted
                            ? "Marcaste disponible este día (clic para quitar)"
                            : "No has marcado este día (clic para marcar)"
                        }
                        className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                          isSelectedPlayerVoted
                            ? "bg-amber-500 text-zinc-950 shadow-sm"
                            : "border border-zinc-700 group-hover:border-zinc-500"
                        }`}
                      >
                        {isSelectedPlayerVoted && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    )
                  )}
                </div>

                {/* Badge central de Quórum (ÚNICO elemento que abre el modal de detalle de asistencia) */}
                <div className="my-auto py-1 flex justify-center">
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
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 font-black text-xs sm:text-sm shadow-md shadow-emerald-500/30 animate-pulse hover:bg-emerald-400 transition-colors">
                        <span>★</span>
                        <span>
                          {voterCount}/{totalParticipants}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md font-bold text-[11px] sm:text-xs transition-colors ${
                          voterCount > 0
                            ? "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-amber-500/60 hover:bg-zinc-700"
                            : "bg-zinc-900/60 text-zinc-600 border border-zinc-800/50 hover:border-zinc-600 hover:text-zinc-400"
                        }`}
                      >
                        {voterCount}/{totalParticipants}
                      </div>
                    )}
                  </button>
                </div>

                {/* Mini Barra de progreso visual */}
                <div className="w-full space-y-1">
                  <div className="w-full h-1 sm:h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isQuorumReached
                          ? "bg-emerald-400"
                          : voterCount > 0
                          ? "bg-amber-500"
                          : "bg-transparent"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Votantes visibles en pantallas medianas */}
                  <div className="hidden sm:flex items-center gap-1 overflow-hidden text-[10px] text-zinc-400 truncate">
                    {voterCount > 0 ? (
                      <span className="truncate">
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
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-56 p-3 bg-zinc-950/95 border border-zinc-700 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none text-left">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
                      <span className="text-xs font-bold text-zinc-200">
                        {formatFriendlyDate(dateKey)}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          isQuorumReached
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {voterCount}/{totalParticipants}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Confirmados ({voterCount}):
                      </div>
                      {voterCount > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {voters.map((name) => (
                            <span
                              key={name}
                              className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px] border border-zinc-700"
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
                          <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider pt-1">
                            Faltan ({totalParticipants - voterCount}):
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {poll.participants
                              .filter((p) => !voters.includes(p))
                              .map((name) => (
                                <span
                                  key={name}
                                  className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 text-[11px]"
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
      </div>

      {/* Barra de Acciones de Exportación */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
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
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
          >
            <Copy className="w-4 h-4" />
            {copiedWhatsApp ? "¡Resumen Copiado!" : "Copiar para WhatsApp"}
          </button>

          {/* Botón Google Calendar: directo para 1 fecha o dropdown inteligente para múltiples fechas */}
          {confirmedDates.length === 0 ? (
            <button
              disabled
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-zinc-800/50 text-zinc-500 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-zinc-800"
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
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-zinc-700 active:scale-95 shadow-sm"
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
                className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-zinc-700 active:scale-95 shadow-sm"
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
                <div className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 z-40 w-72 sm:w-80 bg-zinc-950/95 border border-zinc-700 rounded-2xl shadow-2xl backdrop-blur-xl p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                    <span className="font-semibold text-zinc-200">Agendar en Google Calendar:</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px]">
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
                        className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 transition-all text-xs text-zinc-200 group"
                      >
                        <span className="font-medium text-zinc-300 group-hover:text-white">
                          {formatFriendlyDate(date)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                          Abrir <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        confirmedDates.forEach((date) => {
                          window.open(generateGoogleCalendarUrl(poll.title, date), "_blank");
                        });
                        setShowGoogleDropdown(false);
                      }}
                      className="w-full py-1.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Abrir todas las fechas en pestañas
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center leading-tight">
                      💡 Usa <strong className="text-zinc-300">&quot;Descargar .ics&quot;</strong> si prefieres importar todas juntas en 1 archivo.
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
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border ${
              confirmedDates.length > 0
                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 active:scale-95"
                : "bg-zinc-800/50 text-zinc-500 border-zinc-800 cursor-not-allowed"
            }`}
          >
            <Download className="w-4 h-4" />
            Descargar .ics
          </button>
        </div>
      </div>

      {/* Modal de Detalle de Día */}
      {activeDayModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveDayModal(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[#0e1017] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 cursor-default"
          >
            <button
              onClick={() => setActiveDayModal(null)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Detalle de Disponibilidad
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mt-1">
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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <span className="font-semibold text-zinc-300">Quórum de la mesa:</span>
                    <span
                      className={`font-bold px-2.5 py-1 rounded-lg ${
                        isQuorum
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      {voterCount} de {totalParticipants} confirmados ({Math.round((voterCount / (totalParticipants || 1)) * 100)}%)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-zinc-400 uppercase tracking-wider block text-[11px]">
                      Disponibles ({voterCount}):
                    </span>
                    {voterCount > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {voters.map((name) => (
                          <span
                            key={name}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-medium"
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
                      <span className="font-semibold text-zinc-500 uppercase tracking-wider block text-[11px]">
                        Faltan por confirmar ({missingPlayers.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missingPlayers.map((name) => (
                          <span
                            key={name}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 font-medium"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Si el usuario tiene personaje seleccionado y el día no ha pasado, botón directo de votar */}
                  {selectedPlayer && activeDayModal.dateString >= todayDateStr && (
                    <div className="pt-3 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          toggleDateAvailability(activeDayModal.dateString);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                          voters.includes(selectedPlayer)
                            ? "bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300"
                            : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                        }`}
                      >
                        {voters.includes(selectedPlayer) ? (
                          <>
                            <X className="w-4 h-4" />
                            Quitar mi disponibilidad
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
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
