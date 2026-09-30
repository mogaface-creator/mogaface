import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

// "Regal" gradient (Royal Amethyst → Deep Plum) for the primary CTA, per the
// brand guide's own gradient-usage note ("CTA buttons, dark feature sections").
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[image:var(--gradient-regal)] text-accent-foreground shadow-[var(--shadow-medium)] hover:opacity-90",
  secondary: "border border-border text-foreground hover:bg-surface-warm",
  ghost: "text-muted hover:text-foreground",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-[opacity,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
