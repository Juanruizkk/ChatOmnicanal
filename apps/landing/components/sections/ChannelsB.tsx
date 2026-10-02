"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { SectionHeading } from "./SectionHeading";

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IgIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function MsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.26L19.752 8l-6.561 6.963z" />
    </svg>
  );
}

interface GlareCardProps {
  children: React.ReactNode;
  glareColor: string;
  className?: string;
}

function GlareCard({ children, glareColor, className = "" }: GlareCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { stiffness: 300, damping: 30 };
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-10, 10]), springConfig);
  const glareOpacity = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
    glareOpacity.set(1);
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
    glareOpacity.set(0);
  };

  const glareX = useTransform(mouseX, [0, 1], [0, 100]);
  const glareY = useTransform(mouseY, [0, 1], [0, 100]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          opacity: glareOpacity,
          background: useTransform(
            [glareX, glareY],
            ([x, y]) =>
              `radial-gradient(circle at ${x}% ${y}%, ${glareColor} 0%, transparent 65%)`
          ),
          transition: "opacity 0.2s",
        }}
      />
      {children}
    </motion.div>
  );
}

const channels = [
  {
    name: "WhatsApp",
    Icon: WaIcon,
    iconColor: "text-white",
    headerBg: "bg-wa",
    glareColor: "rgba(17, 134, 74, 0.35)",
    body: "Responde desde el número de tu negocio, incluso si ya usás la app WhatsApp Business.",
    detail: "Detecta conversaciones desde anuncios Click-to-WhatsApp.",
  },
  {
    name: "Instagram",
    Icon: IgIcon,
    iconColor: "text-white",
    headerBg: "bg-ig",
    glareColor: "rgba(193, 53, 138, 0.35)",
    body: "Contesta los mensajes directos de tu cuenta profesional.",
    detail: "Hasta 4 preguntas sugeridas para iniciar la charla.",
  },
  {
    name: "Messenger",
    Icon: MsIcon,
    iconColor: "text-white",
    headerBg: "bg-ms",
    glareColor: "rgba(29, 111, 224, 0.35)",
    body: "Atiende los mensajes que llegan a tu página de Facebook.",
    detail: "Detecta conversaciones desde anuncios Click-to-Messenger.",
  },
] as const;

export function ChannelsVariantB() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <SectionHeading eyebrow="Canales" title="Responde en el mismo canal donde te escribieron.">
        Cada cliente recibe la respuesta por donde preguntó. Vos ves todo junto.
      </SectionHeading>
      <div className="mt-12 grid gap-4 md:grid-cols-3" style={{ perspective: "1000px" }}>
        {channels.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.12 }}
          >
            <GlareCard glareColor={c.glareColor} className="h-full">
              <div className={`${c.headerBg} px-6 py-5 sm:px-7`}>
                <c.Icon className={`size-8 ${c.iconColor}`} />
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="text-lg font-semibold tracking-tight">{c.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/80">{c.body}</p>
                <p className="mt-3 text-xs leading-relaxed text-muted">{c.detail}</p>
              </div>
            </GlareCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
