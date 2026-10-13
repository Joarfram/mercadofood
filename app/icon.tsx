import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#087c4a",
          borderRadius: "14px",
          color: "white",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          fontSize: 34,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        MF
      </div>
    ),
    size,
  );
}

