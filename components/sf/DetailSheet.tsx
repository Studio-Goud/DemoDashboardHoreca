"use client";

/**
 * Generic drill-down sheet — schuift uit de onderkant op mobile,
 * centreert op desktop. Gebruikt door alle widgets die "tap voor meer"
 * willen tonen. Bouwt op de bestaande Modal/sheet variant maar voegt
 * een sticky header met titel + sluitknop toe en een grotere
 * max-width zodat tabellen/charts ademruimte krijgen.
 */
import Modal from "./Modal";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  titel: string;
  /** Korte regel onder de titel — context, zoals datum of periode. */
  subtitel?: string;
  /** Accent-kleur — voor de hairline + sluitknop-hover. */
  hex?: string;
  children: React.ReactNode;
}

export default function DetailSheet({ open, onClose, titel, subtitel, hex, children }: Props) {
  return (
    <Modal open={open} onClose={onClose} titel={titel} variant="sheet">
      <div
        className="flex flex-col max-h-[85vh]"
        style={{ width: "min(640px, 92vw)" }}
      >
        <div
          className="sticky top-0 z-10 px-5 pt-5 pb-3 flex items-start justify-between gap-3"
          style={{
            background: "var(--sf-bg-elevated)",
            borderBottom: "1px solid var(--sf-hairline)",
            borderTopLeftRadius: "inherit",
            borderTopRightRadius: "inherit",
          }}
        >
          <div className="min-w-0">
            <h2
              className="font-display text-[18px] font-semibold tracking-tight"
              style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
            >
              {titel}
            </h2>
            {subtitel && (
              <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                {subtitel}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: "var(--sf-bg-deep)",
              color: hex ?? "var(--text)",
              border: "1px solid var(--sf-hairline)",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </Modal>
  );
}
