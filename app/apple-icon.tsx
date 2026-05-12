import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

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
            "linear-gradient(135deg, #0A84FF 0%, #30B26F 55%, #E07A1F 100%)",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 600,
            color: "#FFFFFF",
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
