import type { Metadata } from "next";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://coordinator-dnd.vercel.app"
  ),
  title: {
    default: "Coordinator DnD | Encuentra la fecha perfecta para tu sesión",
    template: "%s | CoordinatorDnD",
  },
  description:
    "Coordinador mensual de sesiones de Dungeons & Dragons con quórum estricto (100%) y sincronización en tiempo real.",
  keywords: [
    "D&D",
    "Dungeons & Dragons",
    "coordinador",
    "sesiones",
    "rol",
    "calendario",
    "quórum",
  ],
  authors: [{ name: "CoordinatorDnD" }],
  openGraph: {
    title: "Coordinator DnD | Encuentra la fecha perfecta para tu sesión",
    description:
      "Coordinador mensual de sesiones de Dungeons & Dragons con quórum estricto (100%) y sincronización en tiempo real.",
    url: "https://coordinator-dnd.vercel.app",
    siteName: "CoordinatorDnD",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 675,
        alt: "CoordinatorDnD - Coordinador de sesiones de D&D",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coordinator DnD | Encuentra la fecha perfecta para tu sesión",
    description:
      "Coordinador mensual de sesiones de Dungeons & Dragons con quórum estricto (100%) y sincronización en tiempo real.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#090a0f] text-zinc-100 min-h-screen antialiased selection:bg-amber-500 selection:text-zinc-950">
        <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:border-amber-400 transition-colors">
                🎲
              </span>
              <span className="font-extrabold tracking-tight text-lg sm:text-xl text-zinc-100">
                Coordinator<span className="text-amber-400">DnD</span>
              </span>
            </a>
            <div className="flex items-center gap-3">
              <HeaderNav />
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {children}
        </main>

        <footer className="border-t border-zinc-900 mt-16 py-8 text-center text-xs text-zinc-500">
          CoordinatorDnD • Diseñado para grupos de rol que sufren para coincidir fechas por WhatsApp.
        </footer>
      </body>
    </html>
  );
}
