import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const BB = "#0A84FF";
const SL = "#30B26F";
const KL = "#E07A1F";

function glow(c: string): string {
  return `0 0 8px ${c}, 0 0 18px ${c}, 0 0 32px ${c}80`;
}

export default function AppleIcon() {
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
            marginTop: 32,
            fontSize: 20,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: 2,
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
            top: 78,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          {/* H */}
          <div
            style={{
              position: "relative",
              width: 48,
              height: 66,
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 10,
                height: 66,
                background: BB,
                borderRadius: 5,
                boxShadow: glow(BB),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 28,
                left: 0,
                width: 48,
                height: 10,
                background: SL,
                borderRadius: 5,
                boxShadow: glow(SL),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 38,
                width: 10,
                height: 66,
                background: BB,
                borderRadius: 5,
                boxShadow: glow(BB),
              }}
            />
          </div>

          {/* Q */}
          <div
            style={{
              position: "relative",
              width: 60,
              height: 66,
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                width: 50,
                height: 50,
                borderRadius: 25,
                border: `10px solid ${KL}`,
                boxSizing: "border-box",
                boxShadow: glow(KL),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 46,
                left: 38,
                width: 22,
                height: 10,
                background: KL,
                borderRadius: 5,
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
