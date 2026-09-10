import React from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  testId?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={`segmented-track ${fullWidth ? "w-full" : ""} ${className}`.trim()}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={`segmented-item ${fullWidth ? "flex-1" : ""} ${
              isActive ? "segmented-item-active" : ""
            }`}
          >
            {opt.icon && <span className="shrink-0 text-sm">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
