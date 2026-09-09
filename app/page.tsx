"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dices,
  Calendar,
  Users,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Plus,
  X,
  BookmarkCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MONTH_NAMES } from "@/lib/calendarUtils";
import { saveCreatedPoll, getSavedPolls, SavedPoll } from "@/lib/storage";
import { useLanguage } from "@/context/LanguageContext";
import { useTutorial } from "@/context/TutorialContext";
import TutorialCallout from "@/components/TutorialCallout";

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
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-subtle text-amber-300 text-xs font-semibold tracking-wide border border-white/10 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          {t("home.badge")} • Zero Login
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-100 tracking-tight">
          {t("home.heroTitle")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-sm">
            D&D
          </span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          {t("home.heroSubtitle")}
        </p>
      </div>

      {/* Modal / Card de Éxito cuando se crea la sala */}
      {createdRoom ? (
        <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
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
                type="text"
                readOnly
                value={getShareableUrl(createdRoom.slug)}
                className="w-full liquid-glass-input rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-200 focus:outline-none select-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={handleCopyWhatsAppLink}
              data-testid="copy-share-url-btn"
              aria-label={copiedLink ? t("home.copied") : t("home.copyLink")}
              className="flex-1 px-4 py-3.5 ios-btn-emerald text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Copy className="w-4 h-4" />
              {copiedLink ? t("home.copied") : t("home.copyLink")}
            </button>
            <button
              onClick={() => router.push(`/m/${createdRoom.slug}`)}
              data-testid="go-to-created-room-btn"
              aria-label={t("home.goToRoom")}
              className="px-6 py-3.5 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-100 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/15"
            >
              {t("home.goToRoom")}
              <ArrowRight className="w-4 h-4" />
            </button>
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
            onSubmit={handleCreatePoll}
            className="liquid-glass rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
          >
          {/* Sutil resplandor ámbar superior */}
          <div
            className="absolute -right-20 -top-20 w-52 h-52 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)",
            }}
          />

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-3 backdrop-blur-md">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Título de la campaña */}
          <div className="space-y-2">
            <label htmlFor="campaign-title-input" className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
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
              className="w-full liquid-glass-input rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
            <p className="text-[11px] text-zinc-500">
              {t("home.campaignHelp")}
            </p>
          </div>

          {/* Mes y Año */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="campaign-month-select" className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {t("home.monthLabel")}
              </label>
              <select
                id="campaign-month-select"
                data-testid="campaign-month-select"
                aria-label={t("home.monthLabel")}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full liquid-glass-input rounded-2xl px-4 py-3 text-sm text-zinc-100 cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m.index} value={m.index} className="bg-zinc-900 text-zinc-100">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="campaign-year-select" className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                {t("home.yearLabel")}
              </label>
              <select
                id="campaign-year-select"
                data-testid="campaign-year-select"
                aria-label={t("home.yearLabel")}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full liquid-glass-input rounded-2xl px-4 py-3 text-sm text-zinc-100 cursor-pointer"
              >
                {[currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y} className="bg-zinc-900 text-zinc-100">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Participantes */}
          <div className="space-y-3">
            <label htmlFor="participant-input" className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                {t("home.participantsLabel")} ({participants.length})
              </span>
              <span className="text-[11px] text-zinc-500 font-normal">
                (Min 2)
              </span>
            </label>

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
                className="flex-1 liquid-glass-input rounded-2xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={handleAddParticipant}
                data-testid="add-participant-btn"
                aria-label={t("home.addBtn")}
                className="px-4 py-2.5 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all border border-white/10 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {t("home.addBtn")}
              </button>
            </div>

            {/* Tags de participantes */}
            {participants.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center text-xs text-zinc-500 backdrop-blur-sm">
                {t("home.emptyParticipants")}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {participants.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl liquid-glass-subtle border border-white/15 text-zinc-100 text-xs font-semibold shadow-sm"
                  >
                    <span>{name}</span>
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              data-testid="create-poll-submit-btn"
              aria-label={isLoading ? t("home.creatingBtn") : t("home.submitBtn")}
              className="w-full py-4 ios-btn-amber text-zinc-950 font-black text-sm uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              <Dices className="w-5 h-5" />
              {isLoading ? t("home.creatingBtn") : t("home.submitBtn")}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Sección de acceso directo a Mesas Guardadas si existen */}
      {savedPolls.length > 0 && (
        <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
                {t("home.recentPollsTitle")} ({savedPolls.length})
              </h2>
            </div>
            <Link
              href="/mis-mesas"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              {t("home.viewAll")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedPolls.slice(0, 4).map((poll) => {
              const monthName = MONTH_NAMES[locale][poll.month - 1] || "Mes";
              return (
                <Link
                  key={poll.slug}
                  href={`/m/${poll.slug}`}
                  className="p-4 rounded-2xl liquid-glass-subtle hover:border-amber-400/40 hover:bg-white/[0.08] transition-all group flex items-center justify-between active:scale-[0.98]"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-bold text-zinc-200 group-hover:text-amber-300 truncate transition-colors">
                      {poll.title}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
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
