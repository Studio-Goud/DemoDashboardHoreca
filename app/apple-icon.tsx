import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #00B8FF 0%, #00D27A 50%, #FF8A00 100%)",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            color: "#0F172A",
            letterSpacing: "-4px",
            lineHeight: 1,
          }}
        >
          €
        </div>
      </div>
    ),
    { ...size }
  );
}
