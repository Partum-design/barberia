"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { useBarberia } from "@/lib/store";

/**
 * Destino del QR de una cita cuando alguien lo abre con la cámara del
 * teléfono en lugar del escáner del panel. Al personal lo lleva a «Confirmar
 * cita» con el código ya puesto; a cualquier otra persona le explica que el
 * código se muestra en recepción.
 */
export default function ConfirmarRedirigePage() {
  const { listo, sesion } = useBarberia();
  const router = useRouter();
  const [cita, setCita] = useState<string | null>(null);

  useEffect(() => {
    setCita(new URLSearchParams(window.location.search).get("cita"));
  }, []);

  useEffect(() => {
    if (!listo || !sesion || sesion.rol === "cliente") return;
    const base = sesion.rol === "admin" ? "/dashboard/admin/confirmar" : "/dashboard/barbero/confirmar";
    router.replace(cita ? `${base}?cita=${encodeURIComponent(cita)}` : base);
  }, [listo, sesion, cita, router]);

  if (!listo || (sesion && sesion.rol !== "cliente")) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <QrCode className="h-10 w-10 text-[var(--cm-orange)]" />
      <h1 className="anim-in max-w-md text-xl font-semibold">Muestra este código en recepción</h1>
      <p className="anim-in max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
        Al llegar a tu cita, el personal escanea el QR y tu visita se suma sola a tu tarjeta de lealtad.
      </p>
      <Link href={sesion ? "/cuenta" : "/login?next=/cuenta"} className="btn-gold anim-in anim-d1 mt-2 px-6 py-3 text-sm">
        {sesion ? "Ver mis citas" : "Entrar"}
      </Link>
    </main>
  );
}
