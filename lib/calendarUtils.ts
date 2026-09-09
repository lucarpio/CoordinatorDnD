import type { DateCommentsMap, SlotId, TimeMode } from "./supabase";

export type SupportedLocale = "es" | "en";

export const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_NAMES: Record<SupportedLocale, string[]> = {
  es: MONTH_NAMES_ES,
  en: MONTH_NAMES_EN,
};

export const WEEKDAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const WEEKDAYS: Record<SupportedLocale, string[]> = {
  es: WEEKDAYS_ES,
  en: WEEKDAYS_EN,
};

export interface CalendarDay {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
}

/**
 * Genera la cuadrícula de días para un mes dado, comenzando en Lunes (estándar internacional ISO-8601).
 */
export function getMonthDays(year: number, month: number): CalendarDay[] {
  // month es 1-indexado (1 = Enero, 12 = Diciembre)
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);
  const totalDays = lastDayOfMonth.getDate();

  // getDay() devuelve 0 para Domingo, 1 para Lunes, etc.
  // Ajustamos para que Lunes sea 0 y Domingo sea 6.
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const days: CalendarDay[] = [];

  // Días de relleno del mes anterior
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const date = new Date(year, month - 2, dayNum);
    const dateString = formatDateKey(date);
    days.push({
      date,
      dateString,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  // Días del mes actual
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month - 1, day);
    const dateString = formatDateKey(date);
    days.push({
      date,
      dateString,
      dayNumber: day,
      isCurrentMonth: true,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  // Relleno para completar semanas completas (múltiplo de 7, max 42 celdas)
  const remainingDays = (7 - (days.length % 7)) % 7;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month, day);
    const dateString = formatDateKey(date);
    days.push({
      date,
      dateString,
      dayNumber: day,
      isCurrentMonth: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  return days;
}

/**
 * Formatea una fecha en YYYY-MM-DD local
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formatea una fecha para presentación amigable (ej: "Viernes, 18 de Septiembre" / "Friday, September 18")
 */
export function formatFriendlyDate(dateString: string, locale: SupportedLocale = "es"): string {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  if (locale === "en") {
    const weekdayNamesEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = weekdayNamesEn[date.getDay()];
    const monthName = MONTH_NAMES_EN[m - 1];
    return `${dayName}, ${monthName} ${d}`;
  }

  const weekdayNamesEs = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dayName = weekdayNamesEs[date.getDay()];
  const monthName = MONTH_NAMES_ES[m - 1];
  return `${dayName}, ${d} de ${monthName}`;
}

/**
 * Codifica una clave de disponibilidad.
 * Si slotId existe: "2026-09-15#night"
 * Si no: "2026-09-15"
 */
export function encodeAvailabilityKey(dateStr: string, slotId?: SlotId): string {
  return slotId ? `${dateStr}#${slotId}` : dateStr;
}

/**
 * Decodifica una clave de disponibilidad.
 */
export function decodeAvailabilityKey(key: string): { dateStr: string; slotId?: SlotId } {
  if (key.includes("#")) {
    const [dateStr, slotId] = key.split("#");
    return { dateStr, slotId: slotId as SlotId };
  }
  return { dateStr: key };
}

/**
 * Nombre legible con icono para una franja horaria.
 */
export function formatSlotLabel(slotId: SlotId, locale: SupportedLocale = "es"): string {
  if (slotId === "morning") return locale === "en" ? "🌅 Morning" : "🌅 Mañana";
  if (slotId === "afternoon") return locale === "en" ? "☀️ Afternoon" : "☀️ Tarde";
  if (slotId === "night") return locale === "en" ? "🌙 Night" : "🌙 Noche";
  return slotId;
}

/**
 * Nombre corto sin icono para una franja horaria.
 */
export function formatSlotShortLabel(slotId: SlotId, locale: SupportedLocale = "es"): string {
  if (slotId === "morning") return locale === "en" ? "Morning" : "Mañana";
  if (slotId === "afternoon") return locale === "en" ? "Afternoon" : "Tarde";
  if (slotId === "night") return locale === "en" ? "Night" : "Noche";
  return slotId;
}

/**
 * Obtiene los tiempos sugeridos de referencia para Google Calendar y .ics
 */
export function getSlotTimeParams(slotId?: SlotId, defaultTime?: string): { startH: string; endH: string; label: string } {
  if (slotId === "morning") {
    return { startH: "100000", endH: "140000", label: "10:00 AM" };
  }
  if (slotId === "afternoon") {
    return { startH: "160000", endH: "193000", label: "4:00 PM" };
  }
  if (slotId === "night") {
    return { startH: "203000", endH: "235900", label: "8:30 PM" };
  }
  if (defaultTime) {
    const cleanTime = defaultTime.trim();
    const parts = cleanTime.split(":");
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, "0");
      const m = parts[1].slice(0, 2).padStart(2, "0");
      const startH = `${h}${m}00`;
      const endHNum = (parseInt(h, 10) + 3) % 24;
      const endH = `${String(endHNum).padStart(2, "0")}${m}00`;
      return { startH, endH, label: defaultTime };
    }
  }
  return { startH: "203000", endH: "235900", label: "8:30 PM" };
}

/**
 * Genera el enlace parametrizado para Google Calendar (compatible con fechas y franjas)
 */
export function generateGoogleCalendarUrl(
  title: string,
  keyOrDateString: string,
  details?: string,
  locale: SupportedLocale = "es",
  defaultTime?: string
): string {
  const { dateStr, slotId } = decodeAvailabilityKey(keyOrDateString);
  const cleanDate = dateStr.replace(/-/g, "");
  const { startH, endH, label } = getSlotTimeParams(slotId, defaultTime);
  const slotSuffix = slotId ? ` (${formatSlotLabel(slotId, locale)})` : "";

  const startParam = `${cleanDate}T${startH}`;
  const endParam = `${cleanDate}T${endH}`;

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set(
    "text",
    locale === "en" ? `D&D Session: ${title}${slotSuffix}` : `Sesión D&D: ${title}${slotSuffix}`
  );
  url.searchParams.set("dates", `${startParam}/${endParam}`);
  url.searchParams.set(
    "details",
    details ||
      (locale === "en"
        ? `Monthly Dungeons & Dragons session for "${title}".\nTime: ${slotSuffix ? formatSlotLabel(slotId!, locale) : label}. Bring your dice and character sheet!`
        : `Sesión mensual de Dungeons & Dragons para la campaña "${title}".\nHorario: ${slotSuffix ? formatSlotLabel(slotId!, locale) : label}. ¡Trae tus dados y hoja de personaje!`)
  );
  url.searchParams.set("location", locale === "en" ? "Tabletop / Discord" : "En mesa / Discord");

  return url.toString();
}

/**
 * Genera el string RFC 5545 para exportar archivo .ics (Apple Calendar, Outlook, etc.)
 */
export function generateIcsContent(
  title: string,
  confirmedKeys: string[],
  locale: SupportedLocale = "es",
  defaultTime?: string
): string {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const events = confirmedKeys.map((key, idx) => {
    const { dateStr, slotId } = decodeAvailabilityKey(key);
    const cleanDate = dateStr.replace(/-/g, "");
    const { startH, endH, label } = getSlotTimeParams(slotId, defaultTime);
    const slotSuffix = slotId ? ` (${formatSlotLabel(slotId, locale)})` : "";

    const dtstart = `${cleanDate}T${startH}`;
    const dtend = `${cleanDate}T${endH}`;
    const uid = `dnd-session-${cleanDate}-${slotId || "session"}-${idx}@coordinator-dnd`;
    const summary = locale === "en" ? `D&D Session: ${title}${slotSuffix}` : `Sesión D&D: ${title}${slotSuffix}`;
    const description =
      locale === "en"
        ? `Monthly session confirmed with 100% quorum for "${title}". Time: ${slotSuffix || label}.`
        : `Sesión mensual confirmada con 100% de quórum para "${title}". Horario: ${slotSuffix || label}.`;
    const location = locale === "en" ? "Tabletop / Discord" : "En mesa / Discord";

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoordinatorDnD//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Descarga en el navegador el archivo .ics
 */
export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera el resumen para WhatsApp con emojis listo para copiar
 */
export function generateWhatsAppSummary(
  title: string,
  year: number,
  month: number,
  participants: string[],
  confirmedKeys: string[],
  roomUrl?: string,
  locale: SupportedLocale = "es",
  comments?: DateCommentsMap,
  timeMode: TimeMode = "single",
  defaultTime: string = "8:30 PM",
  timeSlots?: SlotId[]
): string {
  const monthName = MONTH_NAMES[locale][month - 1];
  const total = participants.length;

  const timeHeader =
    timeMode === "slots"
      ? (timeSlots || ["morning", "afternoon", "night"])
          .map((s) => formatSlotLabel(s, locale))
          .join(" • ")
      : defaultTime;

  if (locale === "en") {
    let text = `🎲⚔️ *D&D SESSION: ${title.toUpperCase()}* ⚔️🎲\n`;
    text += `📅 *Month:* ${monthName} ${year}\n`;
    text += `⏰ *${timeMode === "slots" ? "Time Slots:" : "Time:"}* ${timeHeader}\n`;
    text += `👥 *Adventurers (${total}):* ${participants.join(", ")}\n\n`;

    if (confirmedKeys.length > 0) {
      text += `✨ *CONFIRMED DATES (100% Quorum)!* ✨\n`;
      confirmedKeys.forEach((key) => {
        const { dateStr, slotId } = decodeAvailabilityKey(key);
        const slotPart = slotId ? ` - ${formatSlotLabel(slotId, "en")}` : ` (${defaultTime})`;
        text += `  ⭐ *${formatFriendlyDate(dateStr, "en")}*${slotPart}\n`;
        const dateNotes = comments?.[dateStr];
        if (dateNotes && dateNotes.length > 0) {
          dateNotes.forEach((note) => {
            text += `     💬 _${note.author}: "${note.text}"_\n`;
          });
        }
      });
      text += `\n🛡️ _Prepare your spells, take a long rest and have your character sheets ready!_\n`;
    } else {
      text += `⏳ *No dates with 100% quorum yet*.\n`;
      text += `Please open the link to mark the days you can play.\n`;
    }

    if (roomUrl) {
      text += `\n🔗 *Live Coordinator:* ${roomUrl}`;
    }

    return text;
  }

  let text = `🎲⚔️ *SESIÓN D&D: ${title.toUpperCase()}* ⚔️🎲\n`;
  text += `📅 *Mes:* ${monthName} ${year}\n`;
  text += `⏰ *${timeMode === "slots" ? "Franjas:" : "Horario:"}* ${timeHeader}\n`;
  text += `👥 *Aventureros (${total}):* ${participants.join(", ")}\n\n`;

  if (confirmedKeys.length > 0) {
    text += `✨ *¡FECHAS CONFIRMADAS (100% Quórum)!* ✨\n`;
    confirmedKeys.forEach((key) => {
      const { dateStr, slotId } = decodeAvailabilityKey(key);
      const slotPart = slotId ? ` - ${formatSlotLabel(slotId, "es")}` : ` (${defaultTime})`;
      text += `  ⭐ *${formatFriendlyDate(dateStr, "es")}*${slotPart}\n`;
      const dateNotes = comments?.[dateStr];
      if (dateNotes && dateNotes.length > 0) {
        dateNotes.forEach((note) => {
          text += `     💬 _${note.author}: "${note.text}"_\n`;
        });
      }
    });
    text += `\n🛡️ _¡Alineen sus hechizos, descansen largo y tengan listas las hojas de personaje!_\n`;
  } else {
    text += `⏳ *Aún no hay fechas con quórum total (100%)*.\n`;
    text += `Por favor entren al enlace para marcar los días en los que pueden jugar.\n`;
  }

  if (roomUrl) {
    text += `\n🔗 *Coordinador en vivo:* ${roomUrl}`;
  }

  return text;
}
