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
  Share2,
  AlertCircle,
  Plus,
  X,
  BookmarkCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MONTH_NAMES_ES } from "@/lib/calendarUtils";
import { saveCreatedPoll, getSavedPolls, SavedPoll } from "@/lib/storage";

export default function Home() {
  const router = useRouter();

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

  // Meses disponibles según el año seleccionado (no muestra meses pasados en el año actual)
  const availableMonths = useMemo(() => {
    return MONTH_NAMES_ES.map((name, idx) => ({
      index: idx + 1,
      name,
    })).filter((m) => {
      if (year === currentYear) {
        return m.index >= currentMonth;
      }
      return true;
    });
  }, [year, currentYear, currentMonth]);

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
      setErrorMessage("Por favor ingresa un título para la campaña o sesión.");
      return;
    }

    if (participants.length < 2) {
      setErrorMessage("Se necesitan al menos 2 participantes para coordinar una sesión.");
      return;
    }

    setIsLoading(true);

    try {
      const slug = generateSlug(title);

      const { data, error } = await supabase
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
          "Ocurrió un error al crear la sala en Supabase. Verifica tu configuración y conexión."
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
    const text = `🎲⚔️ *¡Convocatoria D&D: ${createdRoom.title}!* ⚔️🎲\n\nPor favor entra al siguiente enlace y marca tus días disponibles para la sesión de este mes:\n👉 ${url}\n\n_(Nota: La sesión solo se confirmará si el 100% de la mesa coincide)_`;

    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          Coordinación Sin Fricción • Zero Login
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-100 tracking-tight">
          Encuentra la fecha de tu próxima{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600">
            Sesión de D&D
          </span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Crea una sala en 10 segundos, comparte el enlace en el grupo de WhatsApp y deja que
          cada aventurero marque sus días. <strong>100% quórum garantizado.</strong>
        </p>
      </div>

      {/* Modal / Card de Éxito cuando se crea la sala */}
      {createdRoom ? (
        <div className="bg-zinc-900/90 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">¡Sala Creada con Éxito!</h2>
            <p className="text-sm text-zinc-400">
              Campaña: <strong className="text-zinc-200">{createdRoom.title}</strong>
            </p>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Enlace único para tu grupo:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={getShareableUrl(createdRoom.slug)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs sm:text-sm text-zinc-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCopyWhatsAppLink}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
            >
              <Copy className="w-4 h-4" />
              {copiedLink ? "¡Mensaje Copiado para WhatsApp!" : "Copiar Enlace para WhatsApp"}
            </button>
            <button
              onClick={() => router.push(`/m/${createdRoom.slug}`)}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border border-zinc-700"
            >
              Entrar al Tablero
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Formulario del DM */
        <form
          onSubmit={handleCreatePoll}
          className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6"
        >
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Título de la campaña */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Título de la Campaña / Aventura
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. La Maldición de Strahd, Mesa de los Viernes..."
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          {/* Mes y Año */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Mes a Coordinar
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m.index} value={m.index}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Año
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all cursor-pointer"
              >
                {[currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Participantes */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                Participantes de la mesa (Total: {participants.length})
              </span>
              <span className="text-[11px] text-zinc-500 font-normal">
                (Mínimo 2: DM y jugadores)
              </span>
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nombre o personaje (Enter para agregar)..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleAddParticipant}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border border-zinc-700"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {/* Tags de participantes */}
            {participants.length === 0 ? (
              <div className="p-3.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center text-xs text-zinc-500">
                Aún no has agregado participantes. Escribe el nombre o personaje arriba y pulsa Enter o Agregar.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {participants.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-medium"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(name)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
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
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Dices className="w-5 h-5" />
              {isLoading ? "Creando Sala..." : "Crear Sala y Generar Enlace"}
            </button>
          </div>
        </form>
      )}

      {/* Sección de acceso directo a Mesas Guardadas si existen */}
      {savedPolls.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                Tus Mesas Creadas ({savedPolls.length})
              </h2>
            </div>
            <Link
              href="/mis-mesas"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              Ver todas
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedPolls.slice(0, 4).map((poll) => {
              const monthName = MONTH_NAMES_ES[poll.month - 1] || "Mes";
              return (
                <Link
                  key={poll.slug}
                  href={`/m/${poll.slug}`}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all group flex items-center justify-between"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold text-zinc-200 group-hover:text-amber-400 truncate transition-colors">
                      {poll.title}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {monthName} {poll.year}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
