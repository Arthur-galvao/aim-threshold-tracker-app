import React, { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  className = "",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      // Focus within dialog
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === "Tab") {
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
        previousActiveElementRef.current?.focus();
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 modal-scrim transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        ref={dialogRef}
        className={`relative w-full ${maxWidthClasses} panel p-6 rounded-2xl shadow-overlay border border-edge bg-surface z-10 animate-pop-in ${className}`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-text-main tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-text-secondary mt-1">{description}</p>
            )}
          </div>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Fechar"
            onClick={onClose}
            className="-mr-1.5 -mt-1.5"
          >
            <X size={16} weight="bold" />
          </IconButton>
        </div>

        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
