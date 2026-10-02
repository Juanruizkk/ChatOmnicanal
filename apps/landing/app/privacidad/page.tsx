import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { site } from "@/site.config";
import { mailto } from "@/lib/links";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Cómo ${site.legal.razonSocial} trata los datos personales en ${site.brand}.`,
  alternates: { canonical: "/privacidad/" },
};

export default function PrivacidadPage() {
  const { legal, contact, processors } = site;
  return (
    <LegalPage
      title="Política de privacidad"
      intro={
        <>
          Esta política explica qué datos personales trata {site.brand}, para qué, con quién los compartimos y cómo podés
          ejercer tus derechos. Se rige por la Ley 25.326 de Protección de los Datos Personales de la República
          Argentina.
        </>
      }
    >
      <h2>1. Quiénes somos</h2>
      <p>
        {site.brand} es un servicio de {legal.razonSocial}, CUIT {legal.cuit}, con domicilio en {legal.domicilio} (“
        <strong>nosotros</strong>”). Para cualquier consulta sobre privacidad escribinos a{" "}
        <a href={mailto(contact.privacyEmail)}>{contact.privacyEmail}</a>.
      </p>

      <h2>2. Qué hace el servicio</h2>
      <p>
        {site.brand} permite a negocios (“<strong>clientes</strong>”) responder automáticamente los mensajes que reciben
        por WhatsApp, Instagram y Messenger, y atender esas conversaciones con su equipo desde un panel. Las personas
        que escriben a esos negocios son los “<strong>usuarios finales</strong>”.
      </p>

      <h2>3. En qué rol tratamos cada dato</h2>
      <ul>
        <li>
          <strong>Datos de clientes</strong> (cuenta, equipo, facturación): somos responsables del tratamiento.
        </li>
        <li>
          <strong>Mensajes y datos de usuarios finales</strong>: los tratamos por cuenta y según las instrucciones del
          cliente, que es el responsable. Nosotros actuamos como encargados del tratamiento. Si escribiste a un negocio
          que usa {site.brand}, ese negocio es quien decide sobre tus datos, y también podés contactarnos a nosotros.
        </li>
      </ul>

      <h2>4. Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>Datos de la cuenta del cliente:</strong> nombre, email, teléfono, razón social, datos de facturación y
          los datos de los agentes que invita.
        </li>
        <li>
          <strong>Datos recibidos a través de las plataformas de Meta:</strong> cuando el cliente conecta su cuenta de
          WhatsApp Business, su cuenta profesional de Instagram o su página de Facebook, recibimos mediante las APIs
          oficiales de Meta los mensajes de los usuarios finales, su número de teléfono o identificador en la
          plataforma, su nombre de perfil, la fecha y el estado de los mensajes y, si la conversación se inició desde un
          anuncio, el identificador de ese anuncio. También guardamos los tokens de acceso que Meta emite para operar
          esas cuentas.
        </li>
        <li>
          <strong>Información del negocio:</strong> horarios, direcciones, envíos, medios de pago y los documentos que el
          cliente sube (catálogos, políticas, preguntas frecuentes).
        </li>
        <li>
          <strong>Datos técnicos:</strong> registros de actividad, dirección IP y datos del navegador al usar el panel,
          con fines de seguridad y diagnóstico.
        </li>
      </ul>
      <p>No pedimos ni buscamos tratar datos sensibles. El servicio filtra automáticamente cierto tipo de información antes de procesarla.</p>

      <h2>5. Para qué los usamos</h2>
      <ul>
        <li>Recibir los mensajes y responderlos en nombre del cliente, por el mismo canal.</li>
        <li>Mostrar las conversaciones en el panel y permitir que el equipo del cliente las atienda.</li>
        <li>Medir el uso del servicio por cliente y por canal para facturar y controlar los cupos de cada plan.</li>
        <li>Brindar soporte, prevenir abusos y mantener la seguridad del servicio.</li>
      </ul>
      <p>
        <strong>
          No vendemos datos personales ni los usamos para publicidad. Los datos obtenidos a través de las plataformas de
          Meta se usan únicamente para prestar el servicio al cliente que conectó su cuenta.
        </strong>
      </p>

      <h2>6. Con quién los compartimos</h2>
      <p>Compartimos datos solo con los proveedores necesarios para prestar el servicio:</p>
      <ul>
        <li>
          <strong>Meta Platforms</strong> (WhatsApp, Instagram y Messenger): para recibir y enviar los mensajes.
        </li>
        <li>
          <strong>{processors.llm ?? "Proveedor de inteligencia artificial"}</strong>: procesa el contenido de los
          mensajes y la información del negocio para redactar las respuestas automáticas. Lo usamos a través de su API
          bajo condiciones que no permiten usar esos datos para entrenar sus modelos.
        </li>
        <li>
          <strong>{processors.hosting ?? "Proveedores de infraestructura"}</strong>: alojamiento de servidores y base de
          datos.
        </li>
      </ul>
      <p>
        También podemos revelar datos si una autoridad competente lo exige conforme a la ley. Algunos de estos
        proveedores pueden estar fuera de Argentina; en ese caso exigimos niveles de protección adecuados según la
        normativa vigente.
      </p>

      <h2>7. Cuánto tiempo los guardamos</h2>
      <p>
        Conservamos los datos mientras el cliente tenga su cuenta activa. Si da de baja la cuenta o desconecta un canal,
        eliminamos las conversaciones y los datos asociados dentro de los {site.retentionDays} días, salvo que una ley nos
        obligue a conservar algo por más tiempo (por ejemplo, datos de facturación).
      </p>

      <h2>8. Cómo los protegemos</h2>
      <ul>
        <li>Toda la comunicación viaja cifrada (HTTPS/TLS).</li>
        <li>Los tokens de acceso de Meta se guardan cifrados.</li>
        <li>Los datos de cada cliente están aislados de los demás y el acceso del equipo se controla por roles.</li>
      </ul>

      <h2>9. Tus derechos</h2>
      <p>
        Podés pedir acceso, rectificación, actualización o supresión de tus datos escribiendo a{" "}
        <a href={mailto(contact.privacyEmail, "Datos personales")}>{contact.privacyEmail}</a>. Si sos usuario final,
        indicanos tu número de WhatsApp o tu usuario de Instagram o Facebook y el negocio al que le escribiste. Para
        pedir la eliminación seguí los pasos de{" "}
        <Link href="/eliminacion-de-datos/">eliminación de datos</Link>.
      </p>
      <p>
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
        gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo
        establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en
        su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que
        interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de
        protección de datos personales.
      </p>

      <h2>10. Cookies</h2>
      <p>
        Este sitio no usa cookies de publicidad ni de seguimiento. El panel usa solo las cookies necesarias para
        mantener la sesión iniciada.
      </p>

      <h2>11. Cambios</h2>
      <p>
        Si cambiamos esta política, publicamos la nueva versión en esta página con su fecha de vigencia y, si el cambio
        es importante, avisamos a los clientes por email.
      </p>
    </LegalPage>
  );
}
