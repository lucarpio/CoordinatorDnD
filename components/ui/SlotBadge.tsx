import React from "react";
import { SlotId } from "@/lib/supabase";
import { formatSlotIcon, formatSlotLabel, SupportedLocale } from "@/lib/calendarUtils";

export interface SlotBadgeProps {
  slotId: SlotId;
  count: number;
  totalParticipants?: number;
  isQuorum?: boolean;
  isVoted?: boolean;
  locale?: SupportedLocale;
  compact?: boolean;
  className?: string;
  title?: string;
}

export const SlotBadge: React.FC<SlotBadgeProps> = ({
  slotId,
  count,
  totalParticipants,
  isQuorum = false,
  isVoted = false,
  locale = "es",
  compact = true,
  className = "",
  title,
}) => {
  const icon = formatSlotIcon(slotId);
  const defaultTitle =
    title ||
    `${formatSlotLabel(slotId, locale)}: ${count}${totalParticipants ? `/${totalParticipants}` : ""}${
      isQuorum ? " ★" : ""
    }`;

  const stateClass = isQuorum
    ? "slot-badge-quorum"
    : isVoted
    ? "slot-badge-voted"
    : count > 0
    ? "slot-badge-hasvotes"
    : "slot-badge-empty";

  return (
    <div
      title={defaultTitle}
      className={`slot-badge ${stateClass} ${className}`.trim()}
    >
      <span className="text-xs leading-none">{icon}</span>
      {compact ? (
        <span className="font-mono text-[9px] font-bold leading-none">{count}</span>
      ) : (
        <span className="font-mono text-[9px] sm:text-[10px]">
          {isQuorum ? "★ " : ""}
          {count}
          {totalParticipants ? `/${totalParticipants}` : ""}
        </span>
      )}
    </div>
  );
};

export default SlotBadge;
