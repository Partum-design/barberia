import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoCM } from "@/components/shell/LogoCM";
import { PERFIL } from "@/lib/negocio/perfil";
import "./aviso.css";

const ACTUALIZADO = "19 de noviembre de 2026";
const CONTACTO = "bryan.lopez@partumdesign.com.mx";

export const metadata: Metadata = {
  title: `Aviso de Privacidad · ${PERFIL.nombre}`,
  description: `Cómo ${PERFIL.nombre} trata tus datos personales: qué recogemos, para qué, con quién se comparte y cómo ejercer tus derechos ARCO.`,
  alternates: { canonical: "/aviso-de-privacidad" },
};

export default function AvisoDePrivacidad() {
  return (
    <main className="aviso">
      <header className="aviso-cabecera">
        <Link href="/" className="aviso-marca" aria-label={`Inicio de ${PERFIL.nombre}`}>
          <span className="aviso-logo">
            <LogoCM />
          </span>
          <b>{PERFIL.nombre}</b>
        </Link>
        <Link href="/" className="aviso-volver">
          <ArrowLeft aria-hidden /> Volver al inicio
        </Link>
      </header>

      <article className="aviso-cuerpo">
        <p className="aviso-kicker">Datos personales</p>
        <h1>Aviso de Privacidad</h1>
        <p className="aviso-fecha">Última actualización: {ACTUALIZADO}</p>

        <p>
          Este aviso explica cómo tratamos tus datos personales cuando usas el sitio y la app de {PERFIL.nombre}, conforme a
          la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.
        </p>

        <section>
          <h2>1. Responsable</h2>
          <p>
            <b>{PERFIL.nombre}</b>, con domicilio en {PERFIL.direccion}, es responsable del tratamiento de tus datos.
          </p>
          <p>
            Contacto para cualquier tema de privacidad: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a> · Teléfono {PERFIL.telefono}.
          </p>
        </section>

        <section>
          <h2>2. Datos que recogemos</h2>
          <ul>
            <li>Nombre, teléfono y correo electrónico.</li>
            <li>Tus citas: fecha, hora, barbero, servicios, modalidad (en la barbería o a domicilio) y, si es a domicilio, la dirección que nos des.</li>
            <li>Servicios y productos que compras, y los sellos de tu tarjeta de lealtad.</li>
            <li>
              Sólo si tú la vinculas: tu cuenta de Google (correo y nombre) y el permiso para escribir tus citas en tu Google
              Calendar.
            </li>
            <li>Si activas los avisos en tu dispositivo: un identificador técnico para mandarte notificaciones push.</li>
          </ul>
          <p>No recogemos datos sensibles. No guardamos los datos de tu tarjeta bancaria.</p>
        </section>

        <section>
          <h2>3. Para qué los usamos</h2>
          <ul>
            <li>Agendar, confirmar, cambiar o cancelar tus citas.</li>
            <li>Mandarte recordatorios y avisos de tus citas por notificación push y por correo.</li>
            <li>Llevar tu tarjeta de lealtad y tus recompensas.</li>
            <li>Escribir tus citas en tu Google Calendar, si lo vinculaste.</li>
            <li>Cobrar en la barbería y llevar la caja del negocio.</li>
          </ul>
          <p>No usamos tus datos para publicidad ni los vendemos.</p>
        </section>

        <section>
          <h2>4. Con quién se comparten</h2>
          <p>Sólo con los proveedores que hacen funcionar el servicio, y sólo para eso:</p>
          <ul>
            <li><b>Google</b>: Google Calendar y Gmail, únicamente con tu permiso (ver punto 5), y el acceso con tu cuenta de Google.</li>
            <li><b>Supabase</b>: base de datos y cuentas de acceso de la app.</li>
            <li><b>Vercel</b>: alojamiento del sitio y la app.</li>
            <li><b>Stripe o Mercado Pago</b>: sólo si pagas por esos medios, para procesar el cobro.</li>
          </ul>
          <p>No compartimos tus datos con nadie más, salvo que una autoridad lo requiera conforme a la ley.</p>
        </section>

        <section>
          <h2>5. Permisos de Google</h2>
          <p>Si vinculas tu cuenta de Google te pedimos sólo lo necesario:</p>
          <ul>
            <li><b>Tu correo y nombre básicos</b> (openid, email, profile), para identificarte al entrar.</li>
            <li>
              <b>Ver y crear eventos en tu calendario</b> (calendar.events), para que cada cita aparezca sola en tu Google
              Calendar con un recordatorio una hora antes. No leemos ni modificamos tus otros eventos.
            </li>
          </ul>
          <p>
            Los correos de aviso de tus citas se envían desde la cuenta de la barbería (permiso gmail.send de esa cuenta), nunca
            desde la tuya ni leyendo tu correo.
          </p>
          <p>
            Puedes retirar el acceso cuando quieras desde <b>Cuentas conectadas</b> en tu cuenta de la app, o desde{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              myaccount.google.com/permissions
            </a>
            . Al hacerlo dejamos de escribir en tu calendario; las citas que ya estaban ahí no se borran.
          </p>
          <p>
            El uso que hacemos de la información recibida de las API de Google se apega a la{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
              Política de Datos de Usuario de los Servicios de API de Google
            </a>
            , incluidos los requisitos de uso limitado.
          </p>
        </section>

        <section>
          <h2>6. Cuánto tiempo los guardamos</h2>
          <p>
            Mientras tengas tu cuenta o sigas siendo cliente. El historial de citas y cobros se conserva el tiempo que exijan las
            obligaciones fiscales del negocio. Si cancelas tu cuenta, borramos o anonimizamos el resto de tus datos.
          </p>
        </section>

        <section>
          <h2>7. Tus derechos ARCO</h2>
          <p>
            Puedes <b>acceder</b> a tus datos, pedir que los <b>rectifiquemos</b>, <b>cancelarlos</b> u <b>oponerte</b> a su uso,
            así como revocar tu consentimiento. Escríbenos a <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a> con tu nombre, tu
            teléfono o correo registrado y lo que necesitas. Te respondemos en un máximo de 20 días hábiles.
          </p>
        </section>

        <section>
          <h2>8. Cambios a este aviso</h2>
          <p>Si cambia, publicaremos la versión nueva en esta misma página con su fecha de actualización.</p>
        </section>
      </article>
    </main>
  );
}
