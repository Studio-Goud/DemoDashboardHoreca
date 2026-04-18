"use client";

import { useEffect, useRef, useState } from "react";

const CHARS = "0123456789.,€ ";

function FlapTile({ char, kleur = "#FFC84A" }: { char: string; kleur?: string }) {
  const [top, setTop] = useState(char);
  const [bottom, setBottom] = useState(char);
  const [animating, setAnimating] = useState(false);
  const prev = useRef(char);
  const queue = useRef<string[]>([]);
  const running = useRef(false);

  useEffect(() => {
    if (prev.current === char) return;
    queue.current.push(char);
    prev.current = char;
    if (!running.current) runQueue();
  }, [char]);

  function runQueue() {
    const next = queue.current.shift();
    if (!next) { running.current = false; return; }
    running.current = true;
    setAnimating(true);
    setTimeout(() => {
      setTop(next);
      setAnimating(false);
      setBottom(next);
      setTimeout(runQueue, 40);
    }, 90);
  }

  const isSpace = char === " ";

  return (
    <div
      className="relative inline-block font-mono font-bold select-none"
      style={{
        width: isSpace ? "10px" : "clamp(22px, 4vw, 36px)",
        height: "clamp(36px, 6.5vw, 58px)",
        margin: "0 1px",
        perspective: "200px",
      }}
    >
      {!isSpace && (
        <>
          {/* Tile achtergrond */}
          <div
            className="absolute inset-0 rounded-[4px]"
            style={{ background: "#111418", boxShadow: "0 2px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)" }}
          />

          {/* Bovenste helft — statisch */}
          <div
            className="absolute inset-x-0 top-0 overflow-hidden flex items-end justify-center"
            style={{ height: "50%", borderRadius: "4px 4px 0 0" }}
          >
            <span
              className="leading-none"
              style={{
                fontSize: "clamp(18px, 3.5vw, 30px)",
                color: kleur,
                textShadow: `0 0 14px ${kleur}88`,
                transform: "translateY(50%)",
                display: "block",
              }}
            >
              {top}
            </span>
          </div>

          {/* Scheidingslijn */}
          <div
            className="absolute inset-x-0 z-10"
            style={{ top: "calc(50% - 0.5px)", height: "1px", background: "#000", opacity: 0.8 }}
          />

          {/* Onderste helft — statisch */}
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden flex items-start justify-center"
            style={{ height: "50%", borderRadius: "0 0 4px 4px" }}
          >
            <span
              className="leading-none"
              style={{
                fontSize: "clamp(18px, 3.5vw, 30px)",
                color: kleur,
                textShadow: `0 0 14px ${kleur}88`,
                transform: "translateY(-50%)",
                display: "block",
              }}
            >
              {bottom}
            </span>
          </div>

          {/* Flip animatie — bovenste flap klapt naar beneden */}
          {animating && (
            <div
              className="absolute inset-x-0 top-0 overflow-hidden flex items-end justify-center z-20"
              style={{
                height: "50%",
                background: "#111418",
                borderRadius: "4px 4px 0 0",
                transformOrigin: "bottom center",
                animation: "flapDown 90ms ease-in forwards",
              }}
            >
              <span
                className="leading-none"
                style={{
                  fontSize: "clamp(18px, 3.5vw, 30px)",
                  color: "#FFC84A",
                  transform: "translateY(50%)",
                  display: "block",
                }}
              >
                {bottom}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface Props {
  value: string;
  breedte?: number;
  kleur?: string;
}

export default function SplitFlap({ value, breedte = 10, kleur = "#FFC84A" }: Props) {
  const padded = value.padStart(breedte, " ");
  return (
    <div className="inline-flex items-center">
      {padded.split("").map((c, i) => (
        <FlapTile key={i} char={c} kleur={kleur} />
      ))}
    </div>
  );
}
