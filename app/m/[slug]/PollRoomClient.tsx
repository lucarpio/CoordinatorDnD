"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, Poll, AvailabilityMap } from "@/lib/supabase";
import MonthScheduler from "@/components/MonthScheduler";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

interface PollRoomClientProps {
  slug: string;
}

export default function PollRoomClient({ slug }: PollRoomClientProps) {
  const router = useRouter();

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
        throw new Error(fetchError?.message || "No se encontró la sala de coordinación.");
      }

      setPoll(data as Poll);
    } catch (err: any) {
      console.error("Error fetching poll:", err);
      setError(err.message || "Error al cargar la sala.");
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

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

  // Actualizar disponibilidad en Supabase
  const handleUpdateAvailability = async (newAvailability: AvailabilityMap): Promise<boolean> => {
    if (!slug) return false;

    try {
      const { error: updateError } = await supabase
        .from("polls")
        .update({ availability: newAvailability })
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="text-zinc-400 text-sm font-medium">Cargando tablero de la mesa...</p>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="max-w-md mx-auto bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Sala no encontrada</h2>
        <p className="text-xs text-zinc-400">
          {error || "El enlace ingresado no corresponde a ninguna encuesta activa."}
        </p>
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Crear otra sala
        </button>
      </div>

      <MonthScheduler
        initialPoll={poll}
        onUpdateAvailability={handleUpdateAvailability}
        isRealtimeConnected={isRealtimeConnected}
      />
    </div>
  );
}
