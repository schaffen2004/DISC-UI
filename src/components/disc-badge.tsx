import { cn } from "@/lib/utils";
import { discColorClass, discFullName, type DiscType } from "@/lib/mock-data";

export function DiscBadge({
  type,
  showLabel = false,
  className,
}: {
  type: DiscType;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        discColorClass[type],
        className,
      )}
    >
      <span className="grid h-4 w-4 place-items-center rounded-sm bg-current/20 text-current text-[10px]">
        {type}
      </span>
      {showLabel && <span>{discFullName[type]}</span>}
    </span>
  );
}
