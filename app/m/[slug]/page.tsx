import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import PollRoomClient from "./PollRoomClient";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { data: poll } = await supabase
      .from("polls")
      .select("title, year, month, participants")
      .eq("slug", params.slug)
      .single();

    if (poll?.title) {
      const title = `🎲 Campaña: ${poll.title}`;
      const description = `Coordina la fecha de la sesión para "${poll.title}" (Horario 8:30 PM). Quórum estricto (100%).`;
      return {
        title,
        description,
        openGraph: {
          title: `${title} | CoordinatorDnD`,
          description,
          type: "website",
          images: [
            {
              url: "/og-image.jpg",
              width: 1200,
              height: 675,
              alt: title,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: `${title} | CoordinatorDnD`,
          description,
          images: ["/og-image.jpg"],
        },
      };
    }
  } catch (err) {
    console.error("Error generating metadata for slug:", params.slug, err);
  }

  return {
    title: "Sala de Campaña",
    description: "Coordinador mensual de sesiones de Dungeons & Dragons con quórum estricto (100%).",
  };
}

export default function PollRoomPage({ params }: PageProps) {
  return <PollRoomClient slug={params.slug} />;
}
