"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dices,
  Calendar,
  Users,
  Swords,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Plus,
  X,
  BookmarkCheck,
  Clock,
  Sun,
  Moon,
} from "lucide-react";
import { supabase, TimeMode, SlotId } from "@/lib/supabase";
import { MONTH_NAMES } from "@/lib/calendarUtils";
import { saveCreatedPoll, getSavedPolls, SavedPoll } from "@/lib/storage";
import { useLanguage } from "@/context/LanguageContext";
import { useTutorial } from "@/context/TutorialContext";
import TutorialCallout from "@/components/TutorialCallout";
import Button from "@/components/ui/Button";
import SegmentedControl from "@/components/ui/SegmentedControl";

const HOURS_12 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES_STEPS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function parseTimeComponents(timeStr: string) {
  const [hStr, mStr] = (timeStr || "20:30").split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 20;
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const hour = String(h12).padStart(2, "0");
  const minute = mStr || "30";
  return { hour, minute, period, hour24: h };
}

function build24hTime(hourStr: string, minuteStr: string, period: "AM" | "PM"): string {
  let h = parseInt(hourStr, 10);
  if (isNaN(h)) h = 8;
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minuteStr}`;
}

export default function Home() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { triggerStep, completeStep } = useTutorial();

  // Fecha actual para valores predeterminados
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  // Estado del formulario
  const [title, setTitle] = useState<string>("");
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [participantInput, setParticipantInput] = useState<string>("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [savedPolls, setSavedPolls] = useState<SavedPoll[]>([]);
  const [timeMode, setTimeMode] = useState<TimeMode>("single");
  const [defaultTime, setDefaultTime] = useState<string>("20:30");
  const [selectedSlots, setSelectedSlots] = useState<SlotId[]>(["afternoon", "night"]);

  const toggleSlotSelection = (slot: SlotId) => {
    if (selectedSlots.includes(slot)) {
      if (selectedSlots.length === 1) {
        return; // Mantener al menos 1 franja seleccionada
      }
      setSelectedSlots(selectedSlots.filter((s) => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [createdRoom, setCreatedRoom] = useState<{
    slug: string;
    title: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const copyTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Cargar mesas creadas guardadas localmente
  useEffect(() => {
    const list = getSavedPolls();
    setSavedPolls(list);

    const handleUpdate = () => {
      setSavedPolls(getSavedPolls());
    };
    window.addEventListener("saved_polls_updated", handleUpdate);
    return () => {
      window.removeEventListener("saved_polls_updated", handleUpdate);
    };
  }, []);

  // Disparar tutorial contextual en la página de inicio
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerStep("home_create");
    }, 600);
    return () => clearTimeout(timer);
  }, [triggerStep]);

  // Meses disponibles según el año seleccionado (no muestra meses pasados en el año actual)
  const availableMonths = useMemo(() => {
    const names = MONTH_NAMES[locale] || MONTH_NAMES.es;
    return names.map((name, idx) => ({
      index: idx + 1,
      name,
    })).filter((m) => {
      if (year === currentYear) {
        return m.index >= currentMonth;
      }
      return true;
    });
  }, [year, currentYear, currentMonth, locale]);

  // Si cambia el año y el mes seleccionado quedó en el pasado, resetear al mes actual
  useEffect(() => {
    if (year === currentYear && month < currentMonth) {
      setMonth(currentMonth);
    }
  }, [year, currentYear, currentMonth, month]);

  // Manejadores de lista de participantes
  const handleAddParticipant = () => {
    const trimmed = participantInput.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants([...participants, trimmed]);
      setParticipantInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddParticipant();
    }
  };

  const handleRemoveParticipant = (name: string) => {
    setParticipants(participants.filter((p) => p !== name));
  };

  // Generador de slug limpio y único
  const generateSlug = (rawTitle: string): string => {
    const clean = rawTitle
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remover acentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const randomHash = Math.random().toString(36).substring(2, 7);
    return `${clean || "dnd-session"}-${randomHash}`;
  };

  // Envío del formulario
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage(t("home.errorTitleRequired"));
      return;
    }

    if (participants.length < 2) {
      setErrorMessage(t("home.errorMinParticipants"));
      return;
    }

    if (timeMode === "slots" && selectedSlots.length === 0) {
      setErrorMessage(t("home.errorAtLeastOneSlot"));
      return;
    }

    completeStep("home_create");
    setIsLoading(true);

    try {
      const slug = generateSlug(title);

      const { error } = await supabase
        .from("polls")
        .insert({
          slug,
          title: title.trim(),
          year,
          month,
          participants,
          availability: {},
          time_mode: timeMode,
          time_slots:
            timeMode === "slots"
              ? (["morning", "afternoon", "night"] as SlotId[]).filter((s) => selectedSlots.includes(s))
              : [],
          default_time: defaultTime.trim() || "20:30",
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      saveCreatedPoll({
        slug,
        title: title.trim(),
        year,
        month,
        createdAt: new Date().toISOString(),
        participantsCount: participants.length,
      });

      setCreatedRoom({ slug, title: title.trim() });
    } catch (err: any) {
      console.error("Error creating poll:", err);
      setErrorMessage(
        err.message ||
          "Error creating table in Supabase. Please check your connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getShareableUrl = (slug: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/m/${slug}`;
    }
    return `/m/${slug}`;
  };

  const handleCopyWhatsAppLink = () => {
    if (!createdRoom) return;
    const url = getShareableUrl(createdRoom.slug);
    const text =
      locale === "en"
        ? `🎲⚔️ *D&D Session Call: ${createdRoom.title}!* ⚔️🎲\n\nPlease join the room and mark your available days for this month's session:\n👉 ${url}\n\n_(Note: The session is only confirmed when 100% of the party matches)_`
        : `🎲⚔️ *¡Convocatoria D&D: ${createdRoom.title}!* ⚔️🎲\n\nPor favor entra al siguiente enlace y marca tus días disponibles para la sesión de este mes:\n👉 ${url}\n\n_(Nota: La sesión solo se confirmará si el 100% de la mesa coincide)_`;

    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedLink(false);
    }, 3000);
  };

  return (
    <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-5 sm:space-y-6">
      {/* Hero Section */}
      <div className="text-center pt-2">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-zinc-100 tracking-tight">
          {t("home.heroTitle")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-sm">
            D&D
          </span>
        </h1>
      </div>

      {/* Modal / Card de Éxito cuando se crea la sala */}
      {createdRoom ? (
        <div
          data-testid="created-room-success-card"
          className="liquid-glass-elevated rounded-3xl p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden"
        >
          <div
            className="absolute -right-16 -top-16 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)",
            }}
          />
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-black text-zinc-100 tracking-tight">{t("home.shareModalTitle")}</h2>
            <p className="text-sm text-zinc-400">
              {t("home.campaignName")}: <strong className="text-zinc-200">{createdRoom.title}</strong>
            </p>
          </div>

          <div className="liquid-glass-subtle rounded-2xl p-4 space-y-2 border border-white/10">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
              {t("home.shareModalSubtitle")}
            </span>
            <div className="flex items-center gap-2">
              <input
                data-testid="share-room-url-input"
                type="text"
                readOnly
                value={getShareableUrl(createdRoom.slug)}
                className="w-full liquid-glass-input rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-200 focus:outline-none select-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
              variant="emerald"
              size="lg"
              onClick={handleCopyWhatsAppLink}
              data-testid="copy-share-url-btn"
              aria-label={copiedLink ? t("home.copied") : t("home.copyLink")}
              icon={<Copy className="w-4 h-4" />}
              className="flex-1"
            >
              {copiedLink ? t("home.copied") : t("home.copyLink")}
            </Button>
            <Button
              variant="subtle"
              size="lg"
              onClick={() => router.push(`/m/${createdRoom.slug}`)}
              data-testid="go-to-created-room-btn"
              aria-label={t("home.goToRoom")}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {t("home.goToRoom")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <TutorialCallout
            stepId="home_create"
            currentStepNumber={1}
            totalSteps={4}
            position="top"
            align="center"
          />

          {/* Formulario de Nueva Mesa */}
          <form
            data-testid="create-poll-form"
            onSubmit={handleCreatePoll}
            className="liquid-glass rounded-3xl px-4 sm:px-5 md:px-6 py-3.5 sm:py-4 space-y-3.5 sm:space-y-4 relative overflow-hidden"
          >
            {/* Sutil resplandor ámbar superior */}
            <div
              className="absolute -right-20 -top-20 w-52 h-52 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)",
              }}
            />

            {/* Cabecera del Formulario */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5 relative z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
                  <Dices className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight">
                  {t("home.formTitle")}
                </h2>
              </div>
              <span className="text-xs text-zinc-500 hidden sm:inline-block">
                CoordinatorDnD
              </span>
            </div>

            {errorMessage && (
              <div
                data-testid="form-error-alert"
                className="p-3 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-3 backdrop-blur-md relative z-10"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
                <p data-testid="form-error-message">{errorMessage}</p>
              </div>
            )}

            {/* Grid Principal de 2 Filas x 2 Columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3.5 gap-x-4 md:gap-x-5 relative z-10">
              {/* Fila 1 / Columna 1: Título de la campaña */}
              <div className="space-y-1.5">
                <label
                  htmlFor="campaign-title-input"
                  className="h-5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  {t("home.campaignName")}
                </label>
                <input
                  id="campaign-title-input"
                  data-testid="campaign-title-input"
                  aria-label={t("home.campaignName")}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("home.campaignPlaceholder")}
                  required
                  className="w-full h-10 liquid-glass-input rounded-xl px-3.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              {/* Fila 1 / Columna 2: Mes y Año */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="campaign-month-select"
                      className="h-5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      {t("home.monthLabel")}
                    </label>
                    <select
                      id="campaign-month-select"
                      data-testid="campaign-month-select"
                      aria-label={t("home.monthLabel")}
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full h-10 liquid-glass-input rounded-xl px-3 text-xs sm:text-sm text-zinc-100 cursor-pointer"
                    >
                      {availableMonths.map((m) => (
                        <option key={m.index} value={m.index} className="bg-zinc-900 text-zinc-100">
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="campaign-year-select"
                      className="h-5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-400/60" />
                      {t("home.yearLabel")}
                    </label>
                    <select
                      id="campaign-year-select"
                      data-testid="campaign-year-select"
                      aria-label={t("home.yearLabel")}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full h-10 liquid-glass-input rounded-xl px-3 text-xs sm:text-sm text-zinc-100 cursor-pointer"
                    >
                      {[currentYear, currentYear + 1].map((y) => (
                        <option key={y} value={y} className="bg-zinc-900 text-zinc-100">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Fila 2 / Columna 1: Panel Dedicado de Aventureros / Jugadores */}
              <div
                data-testid="players-card"
                className="liquid-glass-subtle rounded-2xl p-3.5 sm:p-4 border border-white/10 space-y-2.5 flex flex-col h-full"
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="participant-input"
                    className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    {t("home.participantsLabel")}
                    <span
                      data-testid="participants-count"
                      className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[10px] font-bold"
                    >
                      {participants.length}
                    </span>
                  </label>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Min 2
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    id="participant-input"
                    data-testid="participant-input"
                    aria-label={t("home.participantsLabel")}
                    type="text"
                    value={participantInput}
                    onChange={(e) => setParticipantInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("home.participantPlaceholder")}
                    className="flex-1 liquid-glass-input rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500"
                  />
                  <Button
                    type="button"
                    variant="subtle"
                    size="sm"
                    onClick={handleAddParticipant}
                    data-testid="add-participant-btn"
                    aria-label={t("home.addBtn")}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    {t("home.addBtn")}
                  </Button>
                </div>

                {/* Lista con scroll compacto de participantes */}
                <div
                  data-testid="participants-list"
                  className="flex-1 min-h-[90px] overflow-y-auto pr-1 flex flex-col"
                >
                  {participants.length === 0 ? (
                    <div
                      data-testid="empty-participants-placeholder"
                      className="flex-1 rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center p-3 text-center text-xs text-zinc-500"
                    >
                      <Users className="w-4 h-4 text-zinc-600 mb-1 opacity-60" />
                      <p className="leading-snug text-[11px] sm:text-xs text-zinc-400 max-w-[280px]">
                        {t("home.emptyParticipants")}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {participants.map((name) => (
                        <span
                          key={name}
                          data-testid={`participant-chip-${name.toLowerCase().replace(/\s+/g, "-")}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl liquid-glass-subtle border border-white/15 text-zinc-100 text-xs font-semibold shadow-sm"
                        >
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-black">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span data-testid="participant-name">{name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(name)}
                            data-testid={`remove-participant-${name.toLowerCase().replace(/\s+/g, "-")}`}
                            aria-label={`${locale === "en" ? "Remove" : "Eliminar"} ${name}`}
                            className="text-zinc-400 hover:text-red-400 transition-colors p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 2 / Columna 2: Modalidad de Horario (Horario Único vs Franjas) */}
              <div
                data-testid="schedule-mode-card"
                className="liquid-glass-subtle rounded-2xl p-3.5 sm:p-4 border border-white/10 space-y-2.5 flex flex-col h-full"
              >
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {t("home.scheduleModeTitle")}
                </label>

                {/* Segmented Control iOS */}
                <SegmentedControl
                  value={timeMode}
                  onChange={(val) => setTimeMode(val as TimeMode)}
                  fullWidth
                  options={[
                    {
                      value: "single",
                      label: t("home.scheduleModeSingle"),
                      testId: "schedule-mode-single-btn",
                    },
                    {
                      value: "slots",
                      label: t("home.scheduleModeSlots"),
                      testId: "schedule-mode-slots-btn",
                    },
                  ]}
                />

                {/* Input oculto para mantener compatibilidad de testid y formularios fuera de space-y-3 */}
                <input
                  id="default-time-input"
                  data-testid="default-time-input"
                  type="hidden"
                  value={defaultTime}
                />

                {/* Contenido según el modo */}
                {timeMode === "single" ? (
                  (() => {
                    const { hour, minute, period, hour24 } = parseTimeComponents(defaultTime);
                    const isNight = hour24 >= 19 || hour24 < 6;

                    const handleHourChange = (newHour: string) => {
                      setDefaultTime(build24hTime(newHour, minute, period));
                    };
                    const handleMinuteChange = (newMinute: string) => {
                      setDefaultTime(build24hTime(hour, newMinute, period));
                    };
                    const handlePeriodChange = (newPeriod: "AM" | "PM") => {
                      setDefaultTime(build24hTime(hour, minute, newPeriod));
                    };

                    return (
                      <div className="space-y-3 pt-0.5">
                        {/* Cabecera contextual con icono de luna / sol */}
                        <div className="h-5 flex items-center">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            {isNight ? (
                              <Moon className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <Sun className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            {t("home.scheduleSingleTimeLabel")}
                          </span>
                        </div>

                        {/* Triple Selector Segmentado Estilo iOS */}
                        <div className="h-[62px] liquid-glass-subtle p-2 rounded-2xl border border-white/10 flex items-center justify-between gap-2 shadow-inner">
                          {/* Selector de Hora (01 a 12) */}
                          <div className="flex-1 relative">
                            <select
                              value={hour}
                              onChange={(e) => handleHourChange(e.target.value)}
                              data-testid="time-hour-select"
                              aria-label={locale === "en" ? "Hour" : "Hora"}
                              className="w-full h-11 liquid-glass-input rounded-xl text-center font-mono font-bold text-base sm:text-lg text-zinc-100 cursor-pointer appearance-none px-2 focus:ring-1 focus:ring-amber-400/50"
                            >
                              {HOURS_12.map((h) => (
                                <option key={h} value={h} className="bg-zinc-900 text-zinc-100 font-mono">
                                  {h}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-[10px]">
                              ▼
                            </span>
                          </div>

                          {/* Separador de dos puntos */}
                          <span className="text-xl font-mono font-black text-amber-400 animate-pulse select-none">
                            :
                          </span>

                          {/* Selector de Minutos */}
                          <div className="flex-1 relative">
                            <select
                              value={minute}
                              onChange={(e) => handleMinuteChange(e.target.value)}
                              data-testid="time-minute-select"
                              aria-label={locale === "en" ? "Minute" : "Minutos"}
                              className="w-full h-11 liquid-glass-input rounded-xl text-center font-mono font-bold text-base sm:text-lg text-zinc-100 cursor-pointer appearance-none px-2 focus:ring-1 focus:ring-amber-400/50"
                            >
                              {MINUTES_STEPS.map((m) => (
                                <option key={m} value={m} className="bg-zinc-900 text-zinc-100 font-mono">
                                  {m}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-[10px]">
                              ▼
                            </span>
                          </div>

                          {/* Selector AM / PM Segmentado */}
                          <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/10 h-11 items-center">
                            <button
                              type="button"
                              onClick={() => handlePeriodChange("AM")}
                              data-testid="time-period-am-btn"
                              className={`px-3 h-9 rounded-lg text-xs font-black transition-all flex items-center justify-center ${
                                period === "AM"
                                  ? "bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-sm"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePeriodChange("PM")}
                              data-testid="time-period-pm-btn"
                              className={`px-3 h-9 rounded-lg text-xs font-black transition-all flex items-center justify-center ${
                                period === "PM"
                                  ? "bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-sm"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-3 pt-0.5">
                    <div className="h-5 flex items-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {t("home.scheduleSlotsSelectLabel")}
                      </span>
                    </div>
                    <div data-testid="schedule-slots-container" className="h-[62px] grid grid-cols-3 gap-2 items-center w-full">
                      {(
                        [
                          { id: "morning" as const, label: t("home.slotMorning") },
                          { id: "afternoon" as const, label: t("home.slotAfternoon") },
                          { id: "night" as const, label: t("home.slotNight") },
                        ]
                      ).map((slot) => {
                        const isSelected = selectedSlots.includes(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggleSlotSelection(slot.id)}
                            data-testid={`slot-pill-${slot.id}`}
                            aria-pressed={isSelected}
                            className={`w-full h-11 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border active:scale-95 shadow-sm ${
                              isSelected
                                ? "bg-amber-500/25 border-amber-400/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                                : "liquid-glass-subtle border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 opacity-60"
                            }`}
                          >
                            <span className="truncate">{slot.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de Enviar */}
            <div className="pt-1.5 border-t border-white/[0.08] relative z-10">
              <Button
                type="submit"
                variant="amber"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading}
                data-testid="create-poll-submit-btn"
                aria-label={isLoading ? t("home.creatingBtn") : t("home.submitBtn")}
                icon={<Dices className="w-5 h-5" />}
              >
                {isLoading ? t("home.creatingBtn") : t("home.submitBtn")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Sección de acceso directo a Mesas Guardadas si existen */}
      {savedPolls.length > 0 && (
        <div data-testid="recent-polls-section" className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
                {t("home.recentPollsTitle")} ({savedPolls.length})
              </h2>
            </div>
            <Link
              href="/mis-mesas"
              data-testid="view-all-recent-polls-link"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              {t("home.viewAll")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedPolls.slice(0, 6).map((poll) => {
              const monthName = MONTH_NAMES[locale][poll.month - 1] || "Mes";
              return (
                <Link
                  key={poll.slug}
                  href={`/m/${poll.slug}`}
                  data-testid={`recent-poll-link-${poll.slug}`}
                  className="p-3.5 rounded-2xl liquid-glass-subtle hover:border-amber-400/40 hover:bg-white/[0.08] transition-all group flex items-center justify-between active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-2.5">
                    <p className="text-xs sm:text-sm font-bold text-zinc-200 group-hover:text-amber-300 truncate transition-colors">
                      {poll.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {monthName} {poll.year}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
