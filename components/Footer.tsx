"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/[0.06] mt-16 py-8 text-center text-xs text-zinc-500 relative z-10">
      {t("footer.tagline")}
    </footer>
  );
}
