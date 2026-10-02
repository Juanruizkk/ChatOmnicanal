import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { site } from "@/site.config";
import { mailto } from "@/lib/links";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: `Condiciones de uso de ${site.brand}.`,
  alternates: { canonical: "/terminos/" },
};

export default function TerminosPage() {
  const { legal, contact } = site;
  return (
    <LegalPage
      title="Términos y condiciones"
      intro={
        <>
          Estos términos regulan el uso de {site.brand}, un servicio de {legal.razonSocial} (CUIT {legal.cuit}). Al crear
          una cuenta o usar el servicio aceptás estas condiciones.
        </>
      }
    >
      <h2>1. El servicio</h2>
      <p>
        {site.brand} es un software como servicio que responde automáticamente consultas de los clientes de tu negocio
        por WhatsApp, Instagram y Messenger, usando la información que cargás, y te ofrece un panel para que tu equipo
        atienda esas conversaciones. Las respuestas automáticas se limitan a la información de tu negocio.
      </p>

      <h2>2. Cuenta</h2>
      <ul>
        <li>Para usar el servicio tenés que registrarte con datos reales y mantenerlos actualizados.</li>
        <li>Sos responsable de la actividad de tu cuenta y de los agentes que invitás.</li>
        <li>Para conectar canales necesitás cuentas propias de Meta (WhatsApp Business, Instagram profesional o página de Facebook) y aceptar sus condiciones.</li>
      </ul>

      <h2>3. Uso aceptable</h2>
      <p>Te comprometés a:</p>
      <ul>
        <li>
          Cumplir las políticas de Meta, en particular la Política de WhatsApp Business y la Política de Comercio de
          WhatsApp, y las condiciones de Instagram y Messenger.
        </li>
        <li>No enviar spam ni mensajes a personas que no te contactaron o no dieron su consentimiento.</li>
        <li>No usar el servicio para actividades ilegales, engañosas o que vulneren derechos de terceros.</li>
        <li>No intentar acceder a datos de otros clientes ni afectar el funcionamiento del servicio.</li>
      </ul>

      <h2>4. Tu información y tus conversaciones</h2>
      <p>
        Sos responsable de que la información que cargás (precios, horarios, políticas, catálogos) sea correcta y esté
        actualizada, ya que el bot responde con ella. Frente a tus clientes, vos sos el responsable de los datos
        personales de las conversaciones y nosotros los tratamos por tu cuenta, según la{" "}
        <Link href="/privacidad/">política de privacidad</Link>.
      </p>
      <p>
        Las respuestas automáticas se generan con inteligencia artificial y pueden contener errores. Podés revisar las
        conversaciones y tomar el control en cualquier momento.
      </p>

      <h2>5. Planes, pagos y costos de terceros</h2>
      <ul>
        <li>El servicio se paga por mes según el plan elegido. Cada plan incluye un cupo de conversaciones atendidas por el bot y determinados canales.</li>
        <li>Al llegar al cupo, según lo que elijas, se cobra el excedente o se pausan las respuestas automáticas hasta el siguiente período.</li>
        <li>
          Los cargos que aplica Meta por mensajes de plantilla de WhatsApp no están incluidos en la mensualidad y los
          paga el cliente en su cuenta de Meta.
        </li>
        <li>Podemos actualizar los precios avisando con al menos 30 días de anticipación.</li>
      </ul>

      <h2>6. Disponibilidad</h2>
      <p>
        Hacemos lo razonable para que el servicio esté disponible y funcione bien, pero no garantizamos que funcione sin
        interrupciones. El servicio depende de plataformas de terceros (como Meta y proveedores de inteligencia
        artificial e infraestructura) cuyos cambios o fallas pueden afectarlo.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        En la medida que lo permita la ley, no somos responsables por daños indirectos, lucro cesante ni pérdida de
        ventas derivados del uso del servicio, de respuestas basadas en información incorrecta cargada por el cliente o
        de decisiones de Meta sobre sus cuentas. Nuestra responsabilidad total se limita al monto pagado por el cliente en
        los últimos tres meses.
      </p>

      <h2>8. Baja</h2>
      <p>
        Podés dar de baja tu cuenta cuando quieras desde el panel o escribiéndonos. Podemos suspender o cancelar cuentas
        que incumplan estos términos o las políticas de Meta. Tras la baja, los datos se eliminan según la política de
        privacidad.
      </p>

      <h2>9. Cambios</h2>
      <p>
        Podemos modificar estos términos. Publicamos la nueva versión en esta página y, si el cambio es importante, te
        avisamos por email antes de que entre en vigencia.
      </p>

      <h2>10. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Cualquier controversia se someterá a los
        tribunales ordinarios de {legal.jurisdiccion}, sin perjuicio de los derechos que la ley de defensa del consumidor
        pudiera otorgar.
      </p>

      <h2>11. Contacto</h2>
      <p>
        {legal.razonSocial} · {legal.domicilio} · <a href={mailto(contact.email)}>{contact.email}</a> · {contact.phone}
      </p>
    </LegalPage>
  );
}
