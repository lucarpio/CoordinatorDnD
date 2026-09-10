import React from "react";

export type BadgeVariant = "amber" | "emerald" | "neutral" | "danger";
export type BadgeSize = "xs" | "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: "px-1.5 py-0.5 text-[9px]",
  sm: "px-2.5 py-0.5 text-[10px] sm:text-xs",
  md: "px-3 py-1 text-xs",
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  amber: "badge-amber",
  emerald: "badge-emerald",
  neutral: "badge-neutral",
  danger: "badge-base bg-red-500/20 border border-red-500/30 text-red-300",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "sm",
  icon,
  className = "",
  children,
  ...props
}) => {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral;

  return (
    <span className={`${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
