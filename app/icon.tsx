import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          borderRadius: 96,
          color: "transparent",
          backgroundImage:
            "linear-gradient(135deg, #00B8FF 0%, #00D27A 50%, #FF8A00 100%)",
        }}
      >
        <div
          style={{
            fontSize: 320,
            fontWeight: 800,
            color: "#0F172A",
            letterSpacing: "-12px",
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
