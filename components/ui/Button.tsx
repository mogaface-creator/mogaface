import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "accent-outline";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98]",
  secondary:
    "border border-slate-200 bg-white text-slate-900 shadow-xs hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]",
  ghost:
    "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:scale-[0.98]",
  "accent-outline":
    "border border-violet-200 bg-violet-50/60 text-violet-700 hover:bg-violet-100/70 hover:border-violet-300 active:scale-[0.98]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-xs font-semibold rounded-full",
  md: "px-5 py-2.5 text-sm font-semibold rounded-full",
  lg: "px-7 py-3.5 text-base font-semibold rounded-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
