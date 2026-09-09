"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, Poll, AvailabilityMap, DateCommentsMap } from "@/lib/supabase";
import MonthScheduler from "@/components/MonthScheduler";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PollRoomClientProps {
  slug: string;
}

export default function PollRoomClient({ slug }: PollRoomClientProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);

  // Cargar datos iniciales del poll
  const fetchPoll = useCallback(async () => {
    if (!slug) return;
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("polls")
        .select("*")
        .eq("slug", slug)
        .single();

      if (fetchError || !data) {
        throw new Error(
          fetchError?.message ||
            (locale === "en"
              ? "Coordination room not found."
              : "No se encontró la sala de coordinación.")
        );
      }

      setPoll(data as Poll);
    } catch (err: any) {
      console.error("Error fetching poll:", err);
      setError(
        err.message ||
          (locale === "en" ? "Error loading room." : "Error al cargar la sala.")
      );
    } finally {
      setIsLoading(false);
    }
  }, [slug, locale]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  // Configuración de Supabase Realtime
  useEffect(() => {
    if (!slug) return;

    const channel = supabase
      .channel(`poll_channel_${slug}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "polls",
          filter: `slug=eq.${slug}`,
        },
        (payload) => {
          if (payload.new) {
            setPoll(payload.new as Poll);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  // Actualizar disponibilidad y comentarios en Supabase
  const handleUpdateAvailability = async (
    newAvailability: AvailabilityMap,
    newComments?: DateCommentsMap
  ): Promise<boolean> => {
    if (!slug) return false;

    try {
      const payload: { availability: AvailabilityMap; comments?: DateCommentsMap } = {
        availability: newAvailability,
      };
      if (newComments !== undefined) {
        payload.comments = newComments;
      }

      const { error: updateError } = await supabase
        .from("polls")
        .update(payload)
        .eq("slug", slug);

      if (updateError) {
        console.error("Error updating availability:", updateError);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error updating availability:", err);
      return false;
    }
  };

  // Actualizar comentarios de fechas en Supabase
  const handleUpdateComments = async (newComments: DateCommentsMap): Promise<boolean> => {
    if (!slug) return false;

    try {
      const { error: updateError } = await supabase
        .from("polls")
        .update({ comments: newComments })
        .eq("slug", slug);

      if (updateError) {
        console.error("Error updating comments:", updateError);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error updating comments:", err);
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-16 h-16 rounded-3xl liquid-glass flex items-center justify-center border border-white/15 shadow-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
        <p className="text-zinc-400 text-sm font-semibold tracking-tight">
          {locale === "en" ? "Loading table board..." : "Cargando tablero de la mesa..."}
        </p>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="max-w-md mx-auto liquid-glass-elevated rounded-3xl p-7 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-zinc-100 tracking-tight">
          {locale === "en" ? "Room not found" : "Sala no encontrada"}
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {error ||
            (locale === "en"
              ? "The link does not match any active coordination table."
              : "El enlace ingresado no corresponde a ninguna encuesta activa.")}
        </p>
        <button
          onClick={() => router.push("/")}
          data-testid="error-back-home-btn"
          aria-label={t("common.back")}
          className="inline-flex items-center gap-2 px-5 py-2.5 ios-btn-amber text-zinc-950 rounded-2xl text-xs font-black transition-all active:scale-95 shadow-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("common.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          data-testid="room-new-poll-btn"
          aria-label={t("nav.newPoll")}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-semibold text-zinc-300 hover:text-white liquid-glass-subtle border border-white/10 transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
          {t("nav.newPoll")}
        </button>
      </div>

      <MonthScheduler
        initialPoll={poll}
        onUpdateAvailability={handleUpdateAvailability}
        onUpdateComments={handleUpdateComments}
        isRealtimeConnected={isRealtimeConnected}
      />
    </div>
  );
}
