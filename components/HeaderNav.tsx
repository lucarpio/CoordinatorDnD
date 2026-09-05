"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSavedPolls } from "@/lib/storage";
import { Dices, PlusCircle, BookmarkCheck } from "lucide-react";

export default function HeaderNav() {
  const pathname = usePathname();
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
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/mis-mesas"
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
          isMisMesas
            ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-md shadow-amber-500/20"
            : "bg-zinc-900/90 text-zinc-200 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800"
        }`}
      >
        <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
        <span>Mis Mesas</span>
        {savedCount > 0 && (
          <span
            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
              isMisMesas
                ? "bg-zinc-950 text-amber-400"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}
          >
            {savedCount}
          </span>
        )}
      </Link>

      <Link
        href="/"
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
          pathname === "/"
            ? "bg-zinc-800 text-zinc-100 border-zinc-700"
            : "bg-zinc-900/90 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800"
        }`}
      >
        <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">Nueva Mesa</span>
      </Link>
    </div>
  );
}
