import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coordinator DnD | Encuentra la fecha perfecta para tu sesión",
  description: "Coordinador mensual de sesiones de Dungeons & Dragons con quórum estricto y cero fricción.",
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
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800">
                ⚔️ Cero Login • Quórum 100%
              </span>
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
