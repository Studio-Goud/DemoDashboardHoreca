import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const BB = "#0A84FF";
const SL = "#30B26F";
const KL = "#E07A1F";

function glow(c: string): string {
  return `0 0 22px ${c}, 0 0 50px ${c}, 0 0 88px ${c}80`;
}

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* MARKTHAL bovenaan */}
        <div
          style={{
            marginTop: 96,
            fontSize: 56,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: 6,
            lineHeight: 1,
            display: "flex",
          }}
        >
          MARKTHAL
        </div>

        {/* HQ gevormd uit neon-buizen */}
        <div
          style={{
            position: "absolute",
            top: 230,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 40,
          }}
        >
          {/* H — twee verticale buizen (blauw) + crossbar (groen) */}
          <div
            style={{
              position: "relative",
              width: 138,
              height: 180,
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 28,
                height: 180,
                background: BB,
                borderRadius: 14,
                boxShadow: glow(BB),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 76,
                left: 0,
                width: 138,
                height: 28,
                background: SL,
                borderRadius: 14,
                boxShadow: glow(SL),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 110,
                width: 28,
                height: 180,
                background: BB,
                borderRadius: 14,
                boxShadow: glow(BB),
              }}
            />
          </div>

          {/* Q — ring + diagonale staart (beide oranje) */}
          <div
            style={{
              position: "relative",
              width: 170,
              height: 180,
              display: "flex",
            }}
          >
            {/* Ring */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                width: 140,
                height: 140,
                borderRadius: 70,
                border: `28px solid ${KL}`,
                boxSizing: "border-box",
                boxShadow: glow(KL),
              }}
            />
            {/* Staart */}
            <div
              style={{
                position: "absolute",
                top: 130,
                left: 108,
                width: 64,
                height: 26,
                background: KL,
                borderRadius: 13,
                transform: "rotate(40deg)",
                boxShadow: glow(KL),
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
