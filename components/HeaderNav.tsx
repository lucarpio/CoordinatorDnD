"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSavedPolls } from "@/lib/storage";
import { PlusCircle, BookmarkCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

export default function HeaderNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [savedCount, setSavedCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      const polls = getSavedPolls();
      setSavedCount(polls.length);
    };

    updateCount();

    window.addEventListener("saved_polls_updated", updateCount);
    window.addEventListener("storage", updateCount);

    return () => {
      window.removeEventListener("saved_polls_updated", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  const isMisMesas = pathname === "/mis-mesas";

  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <Link
        href="/mis-mesas"
        className={`whitespace-nowrap px-3 sm:px-3.5 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 ${
          isMisMesas
            ? "ios-btn-amber text-zinc-950 font-bold shadow-md shadow-amber-500/20"
            : "liquid-glass-subtle text-zinc-300 hover:text-white"
        }`}
      >
        <BookmarkCheck className={`w-3.5 h-3.5 ${isMisMesas ? "text-zinc-950" : "text-amber-400"}`} />
        <span>{t("nav.misMesas")}</span>
        {savedCount > 0 && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              isMisMesas
                ? "bg-zinc-950/80 text-amber-300"
                : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
            }`}
          >
            {savedCount}
          </span>
        )}
      </Link>

      <Link
        href="/"
        className={`whitespace-nowrap px-3 sm:px-3.5 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 ${
          pathname === "/"
            ? "bg-white/[0.12] text-white border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
            : "liquid-glass-subtle text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">{t("nav.newPoll")}</span>
      </Link>

      {/* Selector de idioma estilo iOS */}
      <LanguageSelector />
    </div>
  );
}
