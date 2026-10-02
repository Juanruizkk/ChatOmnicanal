import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { site } from "@/site.config";
import { mailto } from "@/lib/links";

export const metadata: Metadata = {
  title: "Eliminación de datos",
  description: `Cómo pedir que ${site.brand} elimine tus datos.`,
  alternates: { canonical: "/eliminacion-de-datos/" },
};

export default function EliminacionPage() {
  const { contact } = site;
  return (
    <LegalPage
      title="Eliminación de datos"
      intro={<>Podés pedir que eliminemos tus datos en cualquier momento. Te explicamos cómo hacerlo.</>}
    >
      <h2>Si le escribiste a un negocio que usa {site.brand}</h2>
      <p>
        Mandanos un email a{" "}
        <a href={mailto(contact.privacyEmail, "Eliminación de datos")}>{contact.privacyEmail}</a> con el asunto{" "}
        <strong>“Eliminación de datos”</strong> e incluí:
      </p>
      <ul>
        <li>Tu número de WhatsApp, o tu usuario de Instagram o nombre de Facebook, según el canal que usaste.</li>
        <li>El nombre del negocio al que le escribiste, si lo sabés.</li>
      </ul>
      <p>
        Eliminamos los mensajes, las conversaciones y tus datos de contacto asociados a ese identificador. Te
        confirmamos por email dentro de los {site.deletionResponseDays} días hábiles. Si para hacerlo necesitamos
        verificar que sos el titular, te lo pedimos en la respuesta.
      </p>
      <p>
        Esto borra los datos guardados en {site.brand}. Los mensajes que quedan en tu propia aplicación de WhatsApp,
        Instagram o Messenger los administrás vos desde esas aplicaciones.
      </p>

      <h2>Si sos cliente de {site.brand}</h2>
      <ul>
        <li>
          <strong>Desconectar un canal:</strong> desde el panel podés desconectar WhatsApp, Instagram o Messenger. También
          podés quitar el acceso desde la configuración de integraciones de tu cuenta de Meta.
        </li>
        <li>
          <strong>Eliminar tu cuenta:</strong> pedí la baja desde el panel o escribiendo a{" "}
          <a href={mailto(contact.privacyEmail, "Baja de cuenta")}>{contact.privacyEmail}</a>. Eliminamos tus
          conversaciones, documentos y datos dentro de los {site.retentionDays} días, salvo lo que la ley nos obligue a
          conservar (por ejemplo, comprobantes de facturación).
        </li>
      </ul>

      <h2>Más información</h2>
      <p>
        El detalle de qué datos tratamos y por cuánto tiempo está en la{" "}
        <Link href="/privacidad/">política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
