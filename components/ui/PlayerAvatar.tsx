import React from "react";

export interface PlayerAvatarProps {
  name: string;
  isSelected?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", { box: string; text: string }> = {
  sm: { box: "w-7 h-7 rounded-xl", text: "text-xs" },
  md: { box: "w-9 h-9 sm:w-10 sm:h-10 rounded-2xl", text: "text-sm" },
  lg: { box: "w-11 h-11 rounded-2xl", text: "text-base" },
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  isSelected = false,
  size = "md",
  className = "",
}) => {
  const initial = (name && name.trim().length > 0 ? name.trim().charAt(0) : "?").toUpperCase();
  const config = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const styleClass = isSelected
    ? "ios-btn-amber text-zinc-950 shadow-md font-black"
    : "liquid-glass-subtle border border-white/15 text-amber-300 font-bold";

  return (
    <div
      aria-label={name}
      title={name}
      className={`inline-flex items-center justify-center select-none shrink-0 ${config.box} ${config.text} ${styleClass} ${className}`.trim()}
    >
      {initial}
    </div>
  );
};

export default PlayerAvatar;
