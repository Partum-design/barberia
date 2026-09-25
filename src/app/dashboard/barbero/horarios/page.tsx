"use client";

import Link from "next/link";
import { Scissors } from "lucide-react";
import { PanelShell } from "@/components/shell/PanelShell";
import { EditorHorario } from "@/components/panel/EditorHorario";
import { useBarberia } from "@/lib/store";

// Nodo Barbero: disponibilidad semanal. Los bloques activos son los que
// alimentan los horarios que ve el cliente al agendar en FlujoReserva.
export default function HorariosPage() {
  const store = useBarberia();
  const { listo, sesion } = store;

  if (!listo) return null;

  if (!sesion || sesion.rol !== "barbero") {
    return <SinSesion />;
  }

  return (
    <PanelShell sesion={sesion} activo="Horarios" onLogout={store.logout}>
      <header className="anim-in mb-6">
        <p className="kicker">Disponibilidad</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Horarios</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Define tu disponibilidad semanal. Los clientes solo verán horarios dentro de estos
          bloques.
        </p>
      </header>

      <EditorHorario
        horario={store.horarioDeBarbero(sesion.id)}
        onCambio={(dia, cambios) => store.guardarHorarioDia(sesion.id, dia, cambios)}
      />
    </PanelShell>
  );
}

function SinSesion() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Scissors className="h-8 w-8 text-accent-500" />
      <p className="anim-in text-lg font-semibold">Inicia sesión como barbero para ver este panel</p>
      <Link
        href="/login"
        className="anim-in anim-d1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md"
      >
        Iniciar sesión
      </Link>
    </main>
  );
}
