import { Info } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface InfoTipProps {
  /** Texto explicativo curto (já traduzido). */
  text: string;
  size?: number;
  className?: string;
}

/** Ícone "i" com tooltip explicativo (T4.9). */
export function InfoTip({ text, size = 13, className }: InfoTipProps) {
  return (
    <Tooltip
      content={
        <span className="block max-w-[260px] whitespace-normal leading-snug text-[11px]">{text}</span>
      }
    >
      <span
        className={cn(
          "text-text-faint hover:text-text-main transition-transform duration-200 hover:scale-110 cursor-help inline-flex",
          className
        )}
      >
        <Info size={size} />
      </span>
    </Tooltip>
  );
}
