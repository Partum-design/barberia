import { MessageCircle, Phone } from "lucide-react";
import { PERFIL } from "@/lib/negocio/perfil";

// Llamar y WhatsApp de la barbería: botones grandes, iguales en todas las
// pantallas, para quien prefiere hablar con una persona.

const digitos = (v: string) => v.replace(/\D/g, "");

/** "+525643388834" */
export const TEL_BARBERIA = `+52${digitos(PERFIL.telefono)}`;

/** WhatsApp pide lada de país: a un número de 10 dígitos le antepone el 52. */
export function enlaceWhatsApp(texto: string, numero: string = PERFIL.whatsapp) {
  const d = digitos(numero);
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}?text=${encodeURIComponent(texto)}`;
}

export function BotonesContacto({
  textoWhatsApp = "Hola CortMart, quiero agendar una cita.",
  mostrarNumero = true,
  className = "",
}: {
  textoWhatsApp?: string;
  mostrarNumero?: boolean;
  className?: string;
}) {
  return (
    <div className={`contacto-botones ${className}`}>
      <a href={`tel:${TEL_BARBERIA}`} className="contacto-boton">
        <Phone aria-hidden /> {mostrarNumero ? `Llamar: ${PERFIL.telefono}` : "Llamar a la barbería"}
      </a>
      <a href={enlaceWhatsApp(textoWhatsApp)} target="_blank" rel="noopener noreferrer" className="contacto-boton is-whatsapp">
        <MessageCircle aria-hidden /> Escribir por WhatsApp
      </a>
    </div>
  );
}
