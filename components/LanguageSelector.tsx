"use client";

import React from "react";
import { useLanguage, SupportedLocale } from "@/context/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className="flex items-center gap-0.5 ios-segmented-control p-0.5 rounded-2xl select-none"
      title="Cambiar idioma / Switch language"
    >
      <button
        type="button"
        onClick={() => setLocale("es")}
        data-testid="lang-es-btn"
        className={`px-2 py-1 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
          locale === "es"
            ? "ios-segmented-active"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
        aria-label="Español"
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        data-testid="lang-en-btn"
        className={`px-2 py-1 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
          locale === "en"
            ? "ios-segmented-active"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
