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
          background: "linear-gradient(120deg, #101b33 0%, #14306b 55%, #3b2f8f 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: -1 }}>
            <span>Penta</span>
            <span style={{ color: "#22d3ee" }}>Bot</span>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 5, color: "#9fb3d9", marginTop: 4 }}>CHATBOT OMNICANAL</div>
        </div>
        <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.05, maxWidth: 1000 }}>
          Tus clientes preguntan. Tu negocio responde, a cualquier hora.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 120,
              height: 8,
              borderRadius: 4,
              background: "linear-gradient(90deg, #0bb8d0, #1f74e0, #8457c8)",
            }}
          />
          <div style={{ fontSize: 28, color: "#c5d2ea" }}>WhatsApp · Instagram · Messenger</div>
        </div>
      </div>
    ),
    size,
  );
}
