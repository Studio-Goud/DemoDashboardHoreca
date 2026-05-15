import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const BB = "#0A84FF";
const SL = "#30B26F";
const KL = "#E07A1F";

function NeonBar({ color }: { color: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: 118,
        height: 8,
        marginBottom: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: color,
          borderRadius: 4,
          boxShadow: `0 0 9px ${color}, 0 0 20px ${color}, 0 0 34px ${color}80`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 110,
          height: 1.5,
          borderRadius: 1,
          background: "rgba(255,255,255,0.55)",
        }}
      />
    </div>
  );
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
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 23,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: 1.4,
            marginBottom: 2,
            lineHeight: 1,
          }}
        >
          MARKTHAL
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#FFFFFF",
            opacity: 0.65,
            letterSpacing: 6,
            marginBottom: 24,
            lineHeight: 1,
          }}
        >
          HQ
        </div>

        <NeonBar color={BB} />
        <NeonBar color={SL} />
        <NeonBar color={KL} />
      </div>
    ),
    { ...size },
  );
}
