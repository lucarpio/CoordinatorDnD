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
 * Genera el enlace parametrizado para Google Calendar (8:30 PM a 11:59 PM)
 */
export function generateGoogleCalendarUrl(
  title: string,
  dateString: string,
  details?: string,
  locale: SupportedLocale = "es"
): string {
  const cleanDate = dateString.replace(/-/g, "");
  // 8:30 PM = 20:30:00, fin a 23:59:00
  const startParam = `${cleanDate}T203000`;
  const endParam = `${cleanDate}T235900`;

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set(
    "text",
    locale === "en" ? `D&D Session: ${title}` : `Sesión D&D: ${title}`
  );
  url.searchParams.set("dates", `${startParam}/${endParam}`);
  url.searchParams.set(
    "details",
    details ||
      (locale === "en"
        ? `Monthly Dungeons & Dragons session for "${title}".\nTime: 8:30 PM (20:30). Bring your dice and character sheet!`
        : `Sesión mensual de Dungeons & Dragons para la campaña "${title}".\nHorario: 8:30 PM (20:30). ¡Trae tus dados y hoja de personaje!`)
  );
  url.searchParams.set("location", locale === "en" ? "Tabletop / Discord" : "En mesa / Discord");

  return url.toString();
}

/**
 * Genera el string RFC 5545 para exportar archivo .ics (Apple Calendar, Outlook, etc.)
 */
export function generateIcsContent(
  title: string,
  confirmedDates: string[],
  locale: SupportedLocale = "es"
): string {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const summary = locale === "en" ? `D&D Session: ${title}` : `Sesión D&D: ${title}`;
  const description =
    locale === "en"
      ? `Monthly session confirmed with 100% quorum for "${title}". Time: 8:30 PM.`
      : `Sesión mensual confirmada con 100% de quórum para "${title}". Horario: 8:30 PM.`;
  const location = locale === "en" ? "Tabletop / Discord" : "En mesa / Discord";

  const events = confirmedDates.map((dateStr, idx) => {
    const cleanDate = dateStr.replace(/-/g, "");
    const dtstart = `${cleanDate}T203000`;
    const dtend = `${cleanDate}T235900`;
    const uid = `dnd-session-${cleanDate}-${idx}@coordinator-dnd`;

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
  confirmedDates: string[],
  roomUrl?: string,
  locale: SupportedLocale = "es"
): string {
  const monthName = MONTH_NAMES[locale][month - 1];
  const total = participants.length;

  if (locale === "en") {
    let text = `🎲⚔️ *D&D SESSION: ${title.toUpperCase()}* ⚔️🎲\n`;
    text += `📅 *Month:* ${monthName} ${year}\n`;
    text += `⏰ *Time:* 8:30 PM (Fixed)\n`;
    text += `👥 *Adventurers (${total}):* ${participants.join(", ")}\n\n`;

    if (confirmedDates.length > 0) {
      text += `✨ *CONFIRMED DATES (100% Quorum)!* ✨\n`;
      confirmedDates.forEach((dateStr) => {
        text += `  ⭐ *${formatFriendlyDate(dateStr, "en")}* (8:30 PM)\n`;
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
  text += `⏰ *Horario:* 8:30 PM (Fijo)\n`;
  text += `👥 *Aventureros (${total}):* ${participants.join(", ")}\n\n`;

  if (confirmedDates.length > 0) {
    text += `✨ *¡FECHAS CONFIRMADAS (100% Quórum)!* ✨\n`;
    confirmedDates.forEach((dateStr) => {
      text += `  ⭐ *${formatFriendlyDate(dateStr, "es")}* (8:30 PM)\n`;
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
