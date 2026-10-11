import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { X } from "@phosphor-icons/react";
import { IconButton } from "./IconButton";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  contentClassName?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  className = "",
  contentClassName,
}: DialogProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  const defaultContentClass =
    "mt-2 min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 overscroll-contain";

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 modal-scrim transition-opacity duration-200 animate-fade-in" />
        <BaseDialog.Popup
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 lg:p-6 overflow-hidden pointer-events-none focus:outline-none"
          )}
        >
          <div
            className={cn(
              "pointer-events-auto relative w-full panel p-4 sm:p-6 rounded-2xl shadow-overlay border border-edge bg-surface z-10 max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-pop-in",
              maxWidthClasses,
              className
            )}
          >
            <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
              <div>
                {title && (
                  <BaseDialog.Title className="text-base font-semibold text-text-main tracking-tight font-sans">
                    {title}
                  </BaseDialog.Title>
                )}
                {description && (
                  <BaseDialog.Description className="text-xs text-text-secondary mt-1 font-sans">
                    {description}
                  </BaseDialog.Description>
                )}
              </div>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1.5 -mt-1.5 text-text-faint hover:text-text-main"
              >
                <X size={16} weight="bold" />
              </IconButton>
            </div>

            <div className={contentClassName ?? defaultContentClass}>
              {children}
            </div>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export const DialogRoot = BaseDialog.Root;
export const DialogPortal = BaseDialog.Portal;
export const DialogBackdrop = BaseDialog.Backdrop;
export const DialogPopup = BaseDialog.Popup;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export const DialogClose = BaseDialog.Close;
