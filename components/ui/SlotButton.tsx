import React from "react";
import { Check } from "lucide-react";
import { SlotId } from "@/lib/supabase";
import { formatSlotIcon, formatSlotLabel, formatSlotShortLabel, SupportedLocale } from "@/lib/calendarUtils";

export interface SlotButtonProps {
  slotId: SlotId;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  count?: number;
  totalParticipants?: number;
  isQuorum?: boolean;
  locale?: SupportedLocale;
  compactOnMobile?: boolean;
  useShortLabel?: boolean;
  showCheckmark?: boolean;
  className?: string;
  dataTestId?: string;
  ariaLabel?: string;
}

export const SlotButton: React.FC<SlotButtonProps> = ({
  slotId,
  isSelected,
  onClick,
  disabled = false,
  count = 0,
  totalParticipants,
  isQuorum = false,
  locale = "es",
  compactOnMobile = true,
  useShortLabel = false,
  showCheckmark = false,
  className = "",
  dataTestId,
  ariaLabel,
}) => {
  const icon = formatSlotIcon(slotId);
  const label = useShortLabel ? formatSlotShortLabel(slotId, locale) : formatSlotLabel(slotId, locale);

  const stateClass = isQuorum
    ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-emerald-950/20"
    : isSelected
    ? "slot-btn-active"
    : "slot-btn-idle";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={dataTestId}
      aria-label={ariaLabel || `${label} (${count})`}
      className={`slot-btn ${stateClass} ${className}`.trim()}
    >
      <span className="text-xs sm:text-sm leading-none">{icon}</span>
      <span className={compactOnMobile ? "hidden xs:inline" : "inline"}>
        {label}
      </span>
      {count > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
            isQuorum
              ? "bg-emerald-500/30 text-emerald-200 font-black"
              : "bg-black/30 text-zinc-300"
          }`}
        >
          {isQuorum ? "★ " : ""}
          {count}
          {totalParticipants ? `/${totalParticipants}` : ""}
        </span>
      )}
      {showCheckmark && isSelected && (
        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
      )}
    </button>
  );
};

export default SlotButton;
