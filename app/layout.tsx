import type { Metadata } from "next";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/context/LanguageContext";
import { TutorialProvider } from "@/context/TutorialContext";
import TutorialHelpModal from "@/components/TutorialHelpModal";
import TutorialFloatingButton from "@/components/TutorialFloatingButton";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#08090d] text-zinc-100 min-h-screen antialiased selection:bg-amber-500 selection:text-zinc-950 relative overflow-x-hidden font-sans">
        {/* Orbes de luz ambiental líquida de alto rendimiento (renderizado nativo por GPU sin filtros blur) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0) 70%)",
            }}
          />
          <div
            className="absolute top-20 -right-24 w-[480px] h-[480px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(79, 70, 229, 0.16) 0%, rgba(79, 70, 229, 0) 70%)",
            }}
          />
          <div
            className="absolute top-[45%] left-[20%] w-[400px] h-[400px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, rgba(16, 185, 129, 0) 70%)",
            }}
          />
          <div
            className="absolute -bottom-24 right-[15%] w-[440px] h-[440px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(217, 119, 6, 0.12) 0%, rgba(217, 119, 6, 0) 70%)",
            }}
          />
        </div>

        <LanguageProvider>
          <TutorialProvider>
            {/* Barra de Navegación Flotante estilo iOS Liquid Glass */}
            <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#08090d]/65 border-b border-white/[0.08] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.45)]">
              <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between relative z-10">
                <a href="/" className="flex items-center gap-2 sm:gap-2.5 group active:scale-95 transition-transform flex-shrink-0">
                  <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 group-hover:border-amber-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all flex-shrink-0">
                    🎲
                  </span>
                  <span className="font-extrabold tracking-tight text-base sm:text-xl text-zinc-100 whitespace-nowrap">
                    <span className="hidden sm:inline">Coordinator</span><span className="text-amber-400">DnD</span>
                  </span>
                </a>
                <div className="flex items-center gap-2 sm:gap-3">
                  <HeaderNav />
                </div>
              </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
              {children}
            </main>

            <Footer />
            <TutorialFloatingButton />
            <TutorialHelpModal />
          </TutorialProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
