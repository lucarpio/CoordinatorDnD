import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "amber" | "emerald" | "subtle" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-xl",
  md: "px-4 py-2.5 text-xs rounded-2xl",
  lg: "py-3.5 px-6 text-sm rounded-2xl uppercase tracking-wider",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  amber: "btn-amber",
  emerald: "btn-emerald",
  subtle: "btn-subtle",
  danger: "btn-danger",
  ghost: "btn-base text-zinc-400 hover:text-white hover:bg-white/5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "subtle",
      size = "md",
      icon,
      isLoading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
    const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.subtle;
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
