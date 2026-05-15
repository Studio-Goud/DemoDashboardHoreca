"use client";

/**
 * Shared fullscreen foto-viewer voor medewerker-documenten (ID, paspoort,
 * bankpas). Vervangt twee duplicates: één in DocumentenUploaden (medewerker
 * eigen foto's) en één in MedewerkerDocumentenPanel (owner-review).
 *
 * Features:
 * - Pinch-to-zoom + swipe-to-dismiss via gewone touch events (geen extra
 *   gesture-lib)
 * - ESC + click-outside sluiten
 * - Sci-fi corner-readouts met document-ID en metadata
 * - Inhoud via /api/medewerker/document/[id]/inhoud (auth via cookie)
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { springStiff } from "@/lib/motion";

interface Props {
  /** Document-ID. Null = gesloten. */
  documentId: number | null;
  /** Sluit-callback. */
  onClose: () => void;
  /** Optionele meta-info voor de corner-readouts. */
  meta?: {
    type?: string;
    medewerker?: string;
    uploadDatum?: string;
  };
}

export default function FotoViewer({ documentId, onClose, meta }: Props) {
  const [scale, setScale] = useState(1);
  const lastDist = useRef(0);

  // ESC-handler
  useEffect(() => {
    if (documentId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [documentId, onClose]);

  // Reset zoom bij nieuw doc
  useEffect(() => {
    setScale(1);
  }, [documentId]);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.hypot(dx, dy);
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastDist.current > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist / lastDist.current;
      setScale((s) => Math.max(1, Math.min(4, s * delta)));
      lastDist.current = dist;
    }
  }

  return (
    <AnimatePresence>
      {documentId !== null && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Document bekijken"
          style={{
            background: "rgba(4, 6, 10, 0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Top bar — corner readouts + close */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
          >
            <div className="flex flex-col gap-0.5">
              <span
                className="font-mono text-[10px] tracking-[0.18em] uppercase"
                style={{ color: "var(--sf-accent)" }}
              >
                DOC.{String(documentId).padStart(4, "0")}
              </span>
              {meta?.type && (
                <span
                  className="font-display text-[12px]"
                  style={{ color: "var(--sf-fg-muted)" }}
                >
                  {meta.type}
                  {meta.medewerker && ` · ${meta.medewerker}`}
                </span>
              )}
            </div>

            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              whileTap={{ scale: 0.92 }}
              transition={springStiff}
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: "var(--sf-glass-strong, rgba(255,255,255,0.07))",
                border: "1px solid var(--sf-hairline-strong)",
                color: "var(--sf-fg)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
              aria-label="Sluiten"
            >
              <X size={18} strokeWidth={1.8} />
            </motion.button>
          </div>

          {/* Foto-zone */}
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          >
            <motion.img
              src={`/api/medewerker/document/${documentId}/inhoud`}
              alt="Document"
              draggable={false}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                touchAction: scale > 1 ? "none" : "pinch-zoom",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--sf-hairline-strong)",
                borderRadius: 8,
              }}
              animate={{ scale }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            />
          </div>

          {/* Bottom hint + meta */}
          <div
            className="px-4 pb-4 flex items-center justify-between"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <span
              className="font-mono text-[10px] tracking-[0.15em] uppercase"
              style={{ color: "var(--sf-fg-dim)" }}
            >
              {meta?.uploadDatum ?? "Tap buiten · pinch om te zoomen"}
            </span>
            {scale > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setScale(1); }}
                className="font-mono text-[10px] tracking-wider uppercase px-2 py-1 rounded-sf-sm"
                style={{
                  color: "var(--sf-accent)",
                  border: "1px solid var(--sf-hairline-strong)",
                }}
              >
                Reset zoom
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
