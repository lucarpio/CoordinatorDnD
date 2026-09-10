"use client";

import React, { useMemo } from "react";
import { useLanguage, SupportedLocale } from "@/context/LanguageContext";
import SegmentedControl, { SegmentedOption } from "@/components/ui/SegmentedControl";

export default function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  const options: SegmentedOption<SupportedLocale>[] = useMemo(
    () => [
      { value: "es", label: "ES", testId: "lang-es-btn" },
      { value: "en", label: "EN", testId: "lang-en-btn" },
    ],
    []
  );

  return (
    <div title="Cambiar idioma / Switch language">
      <SegmentedControl
        options={options}
        value={locale}
        onChange={setLocale}
      />
    </div>
  );
}
