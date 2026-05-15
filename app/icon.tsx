import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
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
        width: 332,
        height: 22,
        marginBottom: 26,
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
          borderRadius: 11,
          boxShadow: `0 0 24px ${color}, 0 0 56px ${color}, 0 0 96px ${color}80`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 312,
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.6)",
        }}
      />
    </div>
  );
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
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: 4,
            marginBottom: 4,
            lineHeight: 1,
          }}
        >
          MARKTHAL
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 500,
            color: "#FFFFFF",
            opacity: 0.65,
            letterSpacing: 18,
            marginBottom: 70,
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
