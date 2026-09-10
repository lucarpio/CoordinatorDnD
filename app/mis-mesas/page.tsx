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
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

export default function MisMesasPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { triggerStep } = useTutorial();
  const [savedPolls, setSavedPolls] = useState<SavedPoll[]>([]);
  const [livePolls, setLivePolls] = useState<Record<string, Poll>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const copyTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

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
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedSlug(null);
    }, 2500);
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
          className="btn-amber px-4 py-2.5 text-sm rounded-2xl"
        >
          <PlusCircle className="w-4 h-4" />
          {t("nav.newPoll")}
        </Link>
      </div>

      {/* Listado de Mesas */}
      {savedPolls.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 sm:p-12 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto border border-amber-400/20 shadow-inner">
            <Calendar className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              {t("misMesas.noTablesTitle")}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t("misMesas.noTablesDesc")}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              data-testid="create-first-table-btn"
              className="btn-amber px-5 py-3 text-sm rounded-2xl"
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
                      <Badge variant="emerald" icon={<Sparkles className="w-3.5 h-3.5" />} className="animate-pulse shadow-sm">
                        {locale === "en"
                          ? `★ ${confirmedDates.length} ${confirmedDates.length === 1 ? "date confirmed!" : "dates confirmed!"}`
                          : `¡${confirmedDates.length} ${confirmedDates.length === 1 ? "fecha confirmada" : "fechas confirmadas"}!`}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">
                        {locale === "en" ? "Voting in progress" : "En votación"}
                      </Badge>
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
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => handleCopyWhatsApp(saved.slug, title)}
                      data-testid={`whatsapp-table-btn-${saved.slug}`}
                      aria-label={copiedSlug === saved.slug ? t("home.copied") : `${t("scheduler.whatsAppBtn")} - ${title}`}
                      icon={
                        copiedSlug === saved.slug ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {copiedSlug === saved.slug ? (
                        <span className="text-emerald-400 font-bold">{t("home.copied")}</span>
                      ) : (
                        t("scheduler.whatsAppBtn")
                      )}
                    </Button>

                    <button
                      onClick={() => handleRemove(saved.slug, title)}
                      data-testid={`remove-table-btn-${saved.slug}`}
                      aria-label={`${t("misMesas.confirmDelete")} ${title}`}
                      className="btn-icon text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                      title={t("misMesas.confirmDelete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <Button
                    variant="amber"
                    size="sm"
                    onClick={() => router.push(`/m/${saved.slug}`)}
                    data-testid={`go-to-table-btn-${saved.slug}`}
                    aria-label={`${t("home.goToRoom")} ${title}`}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    {t("home.goToRoom")}
                  </Button>
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
            id="import-poll-input"
            data-testid="import-poll-input"
            aria-label={t("misMesas.importTitle")}
            type="text"
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder={t("misMesas.importPlaceholder")}
            className="flex-1 liquid-glass-input rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500"
          />
          <Button
            type="submit"
            variant="subtle"
            size="sm"
            disabled={importLoading || !importInput.trim()}
            isLoading={importLoading}
            data-testid="import-poll-btn"
            aria-label={importLoading ? t("common.loading") : t("misMesas.importBtn")}
          >
            {importLoading ? t("common.loading") : t("misMesas.importBtn")}
          </Button>
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
