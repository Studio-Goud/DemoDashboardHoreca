"use client";

interface Props {
  hex: string;
  label?: string;
}

export default function PrintKnop({ hex, label = "Print QR-code" }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="w-full py-3 rounded-lg font-mono text-[12px] uppercase tracking-wider"
      style={{ background: hex, color: "#000", minHeight: 44 }}
    >
      {label}
    </button>
  );
}
