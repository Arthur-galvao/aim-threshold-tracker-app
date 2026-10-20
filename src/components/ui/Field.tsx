import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold text-text-secondary inline-flex items-center gap-1 select-none",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && <span className="text-red">*</span>}
    </label>
  )
);
Label.displayName = "Label";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid ? "true" : undefined}
      className={cn("field", className)}
      {...props}
    />
  )
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid ? "true" : undefined}
      className={cn("field min-h-[80px] resize-y", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid ? "true" : undefined}
      className={cn("field appearance-none bg-surface/80 cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      className,
      label,
      description,
      error,
      required,
      htmlFor,
      children,
      ...props
    },
    ref
  ) => {
    const id = useId();
    const targetId = htmlFor || id;

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5 w-full", className)} {...props}>
        {label && (
          <Label htmlFor={targetId} required={required}>
            {label}
          </Label>
        )}
        {children}
        {description && !error && (
          <p className="text-[11px] text-text-faint">{description}</p>
        )}
        {error && (
          <p className="text-[11px] text-red font-medium">{error}</p>
        )}
      </div>
    );
  }
);
Field.displayName = "Field";
