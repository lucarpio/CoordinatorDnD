"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import esDict from "@/locales/es.json";
import enDict from "@/locales/en.json";

export type SupportedLocale = "es" | "en";

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const dictionaries: Record<SupportedLocale, any> = {
  es: esDict,
  en: enDict,
};

const STORAGE_KEY = "coordinator_preferred_locale";

const LanguageContext = createContext<LanguageContextType>({
  locale: "es",
  setLocale: () => {},
  t: (path: string) => path,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("es");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
      if (saved && (saved === "es" || saved === "en")) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
        return;
      }

      // Si no hay preferencia guardada, detectar el idioma del navegador
      const browserLang = navigator.language?.toLowerCase() || "";
      if (browserLang.startsWith("en")) {
        setLocaleState("en");
        document.documentElement.lang = "en";
      } else {
        setLocaleState("es");
        document.documentElement.lang = "es";
      }
    } catch (e) {
      console.warn("Language detection error:", e);
    }
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch (e) {
      console.warn("Error saving preferred locale:", e);
    }
  };

  const t = useMemo(() => {
    return (path: string, params?: Record<string, string | number>): string => {
      const dict = dictionaries[locale] || dictionaries.es;
      const keys = path.split(".");

      let current: any = dict;
      for (const key of keys) {
        if (current && typeof current === "object" && key in current) {
          current = current[key];
        } else {
          // Fallback al diccionario en español si la clave no existe en el idioma actual
          let fallback: any = dictionaries.es;
          for (const fallbackKey of keys) {
            if (fallback && typeof fallback === "object" && fallbackKey in fallback) {
              fallback = fallback[fallbackKey];
            } else {
              fallback = undefined;
              break;
            }
          }
          current = fallback !== undefined ? fallback : path;
          break;
        }
      }

      let result = typeof current === "string" ? current : path;

      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
        }
      }

      return result;
    };
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
