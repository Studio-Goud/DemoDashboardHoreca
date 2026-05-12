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
          background: "#1D1D1F",
          borderRadius: 96,
          color: "transparent",
          backgroundImage:
            "linear-gradient(135deg, #0A84FF 0%, #30B26F 55%, #E07A1F 100%)",
        }}
      >
        <div
          style={{
            fontSize: 320,
            fontWeight: 600,
            color: "#FFFFFF",
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
