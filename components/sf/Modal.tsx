"use client";

/**
 * Modal/Sheet met scale+fade enter, blur-backdrop, ESC-handler en
 * focus-trap voor toetsenbord-gebruikers. Click-outside sluit.
 *
 * Voor mobile gebruik 'sheet' variant — komt op vanaf onderkant.
 */
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springStiff } from "@/lib/motion";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Toegankelijke titel — verplicht voor screenreaders. */
  titel: string;
  variant?: "centered" | "sheet";
  children: React.ReactNode;
}

export default function Modal({ open, onClose, titel, variant = "centered", children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // ESC + focus-trap + restore-focus
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        // Eenvoudige focus-trap binnen het dialog
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // Initial focus naar eerste focusable
    setTimeout(() => {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      focusables?.[0]?.focus();
    }, 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex ${variant === "sheet" ? "items-end" : "items-center"} justify-center p-4`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background: "rgba(4, 6, 10, 0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={titel}
            onClick={(e) => e.stopPropagation()}
            initial={{
              opacity: 0,
              scale: variant === "centered" ? 0.95 : 1,
              y: variant === "sheet" ? "30%" : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: variant === "centered" ? 0.95 : 1,
              y: variant === "sheet" ? "30%" : 0,
            }}
            transition={springStiff}
            className={`relative w-full max-w-md rounded-sf-lg ${variant === "sheet" ? "pb-[env(safe-area-inset-bottom)]" : ""}`}
            style={{
              background: "var(--sf-bg-elevated)",
              border: "1px solid var(--sf-hairline-strong)",
              boxShadow:
                "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px var(--sf-hairline), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
