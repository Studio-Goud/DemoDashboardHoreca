import { ImageResponse } from "next/og";
import { APP_ICON_DATA_URI } from "@/lib/app-icon-svg";

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
          background: "#070709",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={APP_ICON_DATA_URI} width={512} height={512} alt="" />
      </div>
    ),
    { ...size },
  );
}
