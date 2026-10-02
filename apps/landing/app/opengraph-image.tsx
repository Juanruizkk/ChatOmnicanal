import { ImageResponse } from "next/og";
import { site } from "@/site.config";

export const dynamic = "force-static";
export const alt = `${site.brand}: atención automática para WhatsApp, Instagram y Messenger`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#08090c",
          color: "#eceef2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 600 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#3ddc84" }} />
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#f06bc0" }} />
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#5ba2ff" }} />
          </div>
          {site.brand}
        </div>
        <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -3, lineHeight: 1.05, maxWidth: 980 }}>
          Tus clientes preguntan. Tu negocio responde, a cualquier hora.
        </div>
        <div style={{ fontSize: 28, color: "#959caa" }}>WhatsApp · Instagram · Messenger</div>
      </div>
    ),
    size,
  );
}
