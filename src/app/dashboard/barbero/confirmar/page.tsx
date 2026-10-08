"use client";

import { useEffect, useState } from "react";
import { PanelShell } from "@/components/shell/PanelShell";
import { SinAcceso } from "@/components/panel/ModuleUI";
import { ConfirmarCita } from "@/components/citas/ConfirmarCita";
import { useBarberia } from "@/lib/store";

export default function ConfirmarCitaBarberoPage() {
  const store = useBarberia();
  const { listo, sesion } = store;
  const [citaInicial, setCitaInicial] = useState<string | null>(null);

  useEffect(() => {
    setCitaInicial(new URLSearchParams(window.location.search).get("cita"));
  }, []);

  if (!listo) return null;
  if (!sesion || sesion.rol !== "barbero") return <SinAcceso mensaje="Inicia sesión como barbero" />;

  return (
    <PanelShell sesion={sesion} activo="Confirmar cita" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Recepción</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Confirmar cita</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Escanea el QR de tus clientes: su llegada se confirma y se le suma la visita a la tarjeta de lealtad.
        </p>
      </header>
      <ConfirmarCita citaInicial={citaInicial} />
    </PanelShell>
  );
}
