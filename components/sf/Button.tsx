"use client";

/**
 * Sci-fi Button met 44pt minimum tap-target, spring-press en accent-glow.
 * Drie varianten: primary (filled), ghost (outline), bracket (monospace
 * met [ LABEL ] detail).
 */
import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { tap as tapPreset } from "@/lib/motion";

type Variant = "primary" | "ghost" | "bracket" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  /** Override de gloei-intensiteit. Default: medium op hover, hoog op active. */
  glow?: "none" | "subtle" | "intense";
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", glow = "subtle", className = "", children, disabled, ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 font-display rounded-sf transition-colors duration-sf-fast disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  const sizes: Record<Size, string> = {
    sm: "h-11 px-3.5 text-sf-small",        // 44px min, klein
    md: "h-11 px-5 text-sf-body",            // 44px standaard
    lg: "h-12 px-7 text-sf-h3 tracking-tight",
  };

  const variants: Record<Variant, string> = {
    primary: "text-sf-bg bg-sf-accent hover:brightness-110",
    ghost:   "text-sf-fg bg-transparent border border-sf-hairline-strong hover:border-sf-accent hover:text-sf-accent",
    bracket: "text-sf-accent bg-transparent font-mono uppercase tracking-[0.15em] text-sf-caps before:content-['['] before:mr-2 before:opacity-50 after:content-[']'] after:ml-2 after:opacity-50 hover:opacity-90",
    danger:  "text-sf-bg bg-sf-danger hover:brightness-110",
  };

  const glowStyle =
    glow === "none" || disabled
      ? {}
      : variant === "primary" || variant === "danger"
      ? {
          boxShadow:
            glow === "intense"
              ? "0 0 32px var(--sf-accent-glow), 0 0 12px var(--sf-accent-glow)"
              : "0 0 16px var(--sf-accent-glow)",
        }
      : {};

  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={tapPreset.transition}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={glowStyle}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

export default Button;
