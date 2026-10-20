import React from "react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogPortal = BaseDialog.Portal;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export const DialogClose = BaseDialog.Close;

export const DialogBackdrop = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn("fixed inset-0 z-50 modal-scrim transition-opacity", className)}
    {...props}
  />
));
DialogBackdrop.displayName = "DialogBackdrop";

export interface DialogPopupProps
  extends React.ComponentPropsWithoutRef<typeof BaseDialog.Popup> {
  variant?: "dialog" | "sheet";
  showClose?: boolean;
}

export const DialogPopup = React.forwardRef<HTMLDivElement, DialogPopupProps>(
  (
    {
      className,
      variant = "dialog",
      showClose = true,
      children,
      ...props
    },
    ref
  ) => {
    const isSheet = variant === "sheet";

    return (
      <BaseDialog.Popup
        ref={ref}
        className={cn(
          "liquid-float top-layer-popup z-50 p-6 shadow-float focus:outline-none flex flex-col",
          isSheet
            ? "fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-2xl max-h-[86vh] rounded-float"
            : "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-lg max-h-[90vh]",
          className
        )}
        {...props}
      >
        {isSheet && (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-edge-strong" />
        )}
        {showClose && (
          <BaseDialog.Close
            aria-label="Fechar"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full liquid-well text-text-secondary hover:text-text-main transition press cursor-pointer focus-visible:outline-none"
          >
            <X size={15} weight="bold" />
          </BaseDialog.Close>
        )}
        {children}
      </BaseDialog.Popup>
    );
  }
);
DialogPopup.displayName = "DialogPopup";
