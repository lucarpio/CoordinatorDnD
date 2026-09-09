"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dices,
  Calendar,
  Users,
  Copy,
  Check,
  Trash2,
  ArrowRight,
  PlusCircle,
  Sparkles,
  Link as LinkIcon,
  AlertCircle,
  Shield,
} from "lucide-react";
import { getSavedPolls, removeSavedPoll, saveCreatedPoll, SavedPoll } from "@/lib/storage";
import { supabase, Poll } from "@/lib/supabase";
import { MONTH_NAMES, formatFriendlyDate } from "@/lib/calendarUtils";
import { useLanguage } from "@/context/LanguageContext";
import { useTutorial } from "@/context/TutorialContext";
import TutorialCallout from "@/components/TutorialCallout";

export default function MisMesasPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { triggerStep } = useTutorial();
  const [savedPolls, setSavedPolls] = useState<SavedPoll[]>([]);
  const [livePolls, setLivePolls] = useState<Record<string, Poll>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Estado para vincular mesa existente
  const [importInput, setImportInput] = useState<string>("");
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Cargar mesas guardadas en localStorage
  const loadSavedPolls = useCallback(() => {
    const list = getSavedPolls();
    setSavedPolls(list);
    return list;
  }, []);

  // Consultar información actualizada de Supabase
  useEffect(() => {
    const polls = loadSavedPolls();
    if (polls.length === 0) {
      setIsLoading(false);
      return;
    }

    const slugs = polls.map((p) => p.slug);

    const fetchLiveDetails = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("polls")
          .select("*")
          .in("slug", slugs);

        if (!error && data) {
          const map: Record<string, Poll> = {};
          (data as Poll[]).forEach((p) => {
            map[p.slug] = p;
          });
          setLivePolls(map);
        }
      } catch (err) {
        console.error("Error fetching live polls details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveDetails();
  }, [loadSavedPolls]);

  // Disparar tutorial contextual en Mis Mesas
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerStep("tables_hub");
    }, 600);
    return () => clearTimeout(timer);
  }, [triggerStep]);

  // Manejar desvinculación de una mesa
  const handleRemove = (slug: string, title: string) => {
    const message =
      locale === "en"
        ? `Do you want to remove "${title}" from your local list?\n\n(This will not delete data from the server, it only removes it from this browser)`
        : `¿Deseas quitar la mesa "${title}" de tu lista local?\n\n(No borrará los datos del servidor, solo dejará de mostrarse en tu navegador)`;

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    removeSavedPoll(slug);
    setSavedPolls((prev) => prev.filter((p) => p.slug !== slug));
  };

  // Copiar enlace de WhatsApp
  const handleCopyWhatsApp = (slug: string, title: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/m/${slug}`;
    const text =
      locale === "en"
        ? `🎲⚔️ *D&D Session Call: ${title}!* ⚔️🎲\n\nPlease join the room and mark your available days for the session:\n👉 ${url}\n\n_(Note: The session is only confirmed when 100% of the party matches)_`
        : `🎲⚔️ *¡Convocatoria D&D: ${title}!* ⚔️🎲\n\nPor favor entra al siguiente enlace y marca tus días disponibles para la sesión:\n👉 ${url}\n\n_(Nota: La sesión solo se confirmará si el 100% de la mesa coincide)_`;

    navigator.clipboard.writeText(text);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  // Vincular mesa existente ingresando slug o URL
  const handleImportPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccess(null);

    let cleanSlug = importInput.trim();
    if (!cleanSlug) return;

    // Extraer slug si es una URL completa
    if (cleanSlug.includes("/m/")) {
      const parts = cleanSlug.split("/m/");
      cleanSlug = parts[parts.length - 1].split(/[?#]/)[0];
    }

    setImportLoading(true);

    try {
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .eq("slug", cleanSlug)
        .single();

      if (error || !data) {
        setImportError(t("misMesas.importError"));
        return;
      }

      const pollData = data as Poll;
      saveCreatedPoll({
        slug: pollData.slug,
        title: pollData.title,
        year: pollData.year,
        month: pollData.month,
        createdAt: pollData.created_at || new Date().toISOString(),
        participantsCount: pollData.participants?.length || 0,
      });

      setLivePolls((prev) => ({ ...prev, [pollData.slug]: pollData }));
      setSavedPolls(getSavedPolls());
      setImportSuccess(
        locale === "en"
          ? `Table "${pollData.title}" linked successfully!`
          : `¡Mesa "${pollData.title}" vinculada con éxito!`
      );
      setImportInput("");
    } catch (err: any) {
      setImportError(err.message || t("misMesas.importError"));
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Encabezado */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <TutorialCallout
          stepId="tables_hub"
          currentStepNumber={1}
          totalSteps={1}
          position="bottom"
          align="start"
        />
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-subtle text-amber-300 text-xs font-semibold mb-2 border border-white/10 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {locale === "en" ? "Personal Tables Dashboard" : "Panel Personal de Mesas"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            {t("misMesas.title")}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {t("misMesas.subtitle")}
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 ios-btn-amber text-zinc-950 font-black text-sm rounded-2xl active:scale-95 transition-all shadow-md shadow-amber-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          {t("nav.newPoll")}
        </Link>
      </div>

      {/* Listado de Mesas */}
      {savedPolls.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 sm:p-12 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl liquid-glass-subtle flex items-center justify-center mx-auto text-amber-400 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
            <Dices className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-zinc-100 tracking-tight">{t("misMesas.emptyTitle")}</h3>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              {t("misMesas.emptySubtitle")}
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3.5 ios-btn-amber text-zinc-950 font-extrabold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              {t("misMesas.createNewBtn")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {savedPolls.map((saved) => {
            const live = livePolls[saved.slug];
            const title = live?.title || saved.title;
            const year = live?.year || saved.year;
            const month = live?.month || saved.month;
            const monthName = MONTH_NAMES[locale][month - 1] || "Month";
            const participants = live?.participants || [];
            const totalParticipants = participants.length || saved.participantsCount || 0;

            // Calcular fechas con quórum 100%
            const confirmedDates = live
              ? Object.entries(live.availability || {})
                  .filter(([_, voters]) => voters && voters.length >= totalParticipants && totalParticipants > 0)
                  .map(([date]) => date)
                  .sort()
              : [];

            return (
              <div
                key={saved.slug}
                className="liquid-glass rounded-3xl p-5 sm:p-6 transition-all duration-200 shadow-xl space-y-4 relative overflow-hidden"
              >
                {/* Glow sutil si hay fechas confirmadas */}
                {confirmedDates.length > 0 && (
                  <div
                    className="absolute -right-16 -top-16 w-44 h-44 rounded-full pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)",
                    }}
                  />
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-zinc-100 tracking-tight">{title}</h2>
                      <span className="text-xs px-3 py-0.5 rounded-full liquid-glass-subtle border border-white/10 text-zinc-300 font-semibold">
                        {monthName} {year}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      {saved.myCharacter && (
                        <>
                          <span className="flex items-center gap-1.5 text-amber-300 font-bold bg-amber-500/15 px-2.5 py-0.5 rounded-xl border border-amber-400/30">
                            <Shield className="w-3.5 h-3.5" />
                            {locale === "en" ? "Character:" : "Personaje:"} {saved.myCharacter}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        {totalParticipants} {locale === "en" ? "participants" : "participantes"}
                      </span>
                      <span>•</span>
                      <span>{locale === "en" ? "Time: 8:30 PM" : "Horario: 8:30 PM"}</span>
                      {saved.createdAt && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-500">
                            {locale === "en"
                              ? `Created ${new Date(saved.createdAt).toLocaleDateString("en-US")}`
                              : `Creada el ${new Date(saved.createdAt).toLocaleDateString("es-ES")}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Estado de Quórum */}
                  <div>
                    {confirmedDates.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold animate-pulse shadow-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        {locale === "en"
                          ? `★ ${confirmedDates.length} ${confirmedDates.length === 1 ? "date confirmed!" : "dates confirmed!"}`
                          : `¡${confirmedDates.length} ${confirmedDates.length === 1 ? "fecha confirmada" : "fechas confirmadas"}!`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full liquid-glass-subtle text-zinc-400 text-xs font-medium border border-white/10">
                        {locale === "en" ? "Voting in progress" : "En votación"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Si hay fechas confirmadas, mostrarlas resumidas */}
                {confirmedDates.length > 0 && (
                  <div className="bg-emerald-950/40 border border-emerald-500/30 backdrop-blur-md rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs text-emerald-200">
                    <span className="font-bold text-emerald-300">
                      {locale === "en" ? "100% Quorum on:" : "Coincidencia total en:"}
                    </span>
                    {confirmedDates.map((d) => (
                      <span
                        key={d}
                        className="px-2.5 py-0.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 font-semibold"
                      >
                        {formatFriendlyDate(d, locale)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyWhatsApp(saved.slug, title)}
                      className="px-3.5 py-2.5 liquid-glass-subtle hover:bg-white/[0.12] text-zinc-200 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/10 active:scale-95"
                    >
                      {copiedSlug === saved.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">{t("home.copied")}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t("scheduler.whatsAppBtn")}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleRemove(saved.slug, title)}
                      className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
                      title={t("misMesas.confirmDelete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => router.push(`/m/${saved.slug}`)}
                    className="px-4 py-2.5 ios-btn-amber text-zinc-950 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/15 active:scale-95"
                  >
                    <span>{t("home.goToRoom")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sección para vincular mesa existente por enlace o código */}
      <div className="liquid-glass-subtle rounded-3xl p-5 sm:p-6 space-y-3 border border-white/10">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-amber-400" />
          {t("misMesas.importTitle")}
        </h3>
        <p className="text-xs text-zinc-400">
          {locale === "en"
            ? "Paste the link or code (slug) of your table here to add it to your personal list on this browser."
            : "Pega aquí el enlace o código (slug) de tu mesa para añadirla a tu lista personal en este navegador."}
        </p>

        <form onSubmit={handleImportPoll} className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <input
            type="text"
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder={t("misMesas.importPlaceholder")}
            className="flex-1 liquid-glass-input rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={importLoading || !importInput.trim()}
            className="px-4 py-2.5 liquid-glass-subtle hover:bg-white/[0.12] disabled:opacity-50 text-zinc-200 rounded-2xl text-xs font-bold transition-all border border-white/15 flex items-center justify-center gap-1.5 active:scale-95"
          >
            {importLoading ? t("common.loading") : t("misMesas.importBtn")}
          </button>
        </form>

        {importError && (
          <p className="text-xs text-red-400 flex items-center gap-1.5 pt-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {importError}
          </p>
        )}

        {importSuccess && (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            {importSuccess}
          </p>
        )}
      </div>
    </div>
  );
}
