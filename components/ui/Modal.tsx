import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
  testId?: string;
  closeAriaLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  maxWidthClass = "max-w-lg",
  children,
  testId = "modal-container",
  closeAriaLabel = "Cerrar",
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`modal-sheet ${maxWidthClass}`.trim()}
      >
        {/* Grab indicator para pantallas táctiles */}
        <div className="modal-grabber" />

        {/* Botón de cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeAriaLabel}
          title={closeAriaLabel}
          data-testid={`${testId}-close-btn`}
          className="btn-icon absolute top-5 right-5"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado opcional */}
        {(title || subtitle || badge) && (
          <div className="space-y-1">
            {badge && <div>{badge}</div>}
            {title && (
              <h3 className="text-xl font-black text-zinc-100 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Contenido */}
        {children}
      </div>
    </div>
  );
};

export default Modal;
