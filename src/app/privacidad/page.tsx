import { permanentRedirect } from "next/navigation";

/** Alias corto del aviso. */
export default function Privacidad() {
  permanentRedirect("/aviso-de-privacidad");
}
