"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tween-counter à la Bitvavo: cijfertjes rollen vloeiend door wanneer de
 * waarde verandert. Werkt door per frame een tussenwaarde te berekenen
 * met requestAnimationFrame en die door `format` te jagen.
 *
 * Gebruik:
 *   <AnimatedAmount value={omzetVandaag} format={fmtEuro} duurMs={600} />
 *
 * - `value` mag elk getal zijn (positief/negatief, integer/decimaal).
 * - `format` doet de uiteindelijke string-weergave (€, scheidings­tekens, etc.).
 * - `duurMs` is de animatie-tijd in ms (default 600).
 * - Bij eerste render (mount) wordt NIET geanimeerd — direct het correcte
 *   bedrag, geen ruk vanuit 0 op laadtijd.
 */
interface Props {
  value: number;
  format: (n: number) => string;
  duurMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

// easeOutCubic — snel beginnen, vloeiend uitdempen. Voelt natuurlijk voor geld.
function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedAmount({
  value,
  format,
  duurMs = 600,
  className,
  style,
}: Props) {
  const [getoond, setGetoond] = useState(value);
  const vorigeRef = useRef(value);
  const startTijdRef = useRef<number | null>(null);
  const startWaardeRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const eersteRenderRef = useRef(true);

  useEffect(() => {
    // Eerste render: geen animatie, direct synchroniseren.
    if (eersteRenderRef.current) {
      eersteRenderRef.current = false;
      vorigeRef.current = value;
      setGetoond(value);
      return;
    }

    // Identieke waarde: niets te doen.
    if (value === vorigeRef.current) return;

    startWaardeRef.current = vorigeRef.current;
    startTijdRef.current = performance.now();
    vorigeRef.current = value;

    const stap = (nu: number) => {
      const start = startTijdRef.current ?? nu;
      const t = Math.min(1, (nu - start) / duurMs);
      const tussen = startWaardeRef.current + (value - startWaardeRef.current) * ease(t);
      setGetoond(tussen);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(stap);
      } else {
        // Snap naar exact om afrond-residu te voorkomen.
        setGetoond(value);
        frameRef.current = null;
      }
    };

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(stap);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [value, duurMs]);

  return (
    <span className={className} style={style}>
      {format(getoond)}
    </span>
  );
}
