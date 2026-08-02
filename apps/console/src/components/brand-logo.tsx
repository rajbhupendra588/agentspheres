import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  className?: string;
  /** Pixel size for the mark (ignored when variant is `full`). */
  size?: number;
  alt?: string;
  /** `mark` = icon only; `full` = icon + wordmark + tagline. */
  variant?: "mark" | "full";
}

/** AgentSphere brand mark / lockup. */
export function BrandLogo({
  className,
  size = 36,
  alt = "AgentSphere",
  variant = "mark",
}: BrandLogoProps) {
  if (variant === "full") {
    return (
      <img
        src="/logo-full.png"
        alt={alt}
        className={cn("h-auto w-full max-w-[220px] object-contain", className)}
        decoding="async"
      />
    );
  }

  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
      decoding="async"
    />
  );
}
