"use client";

import { useState } from "react";
import { Check, IdCard } from "lucide-react";
import { Campo } from "@/components/panel/Modal";
import { useBarberia, type Cliente } from "@/lib/store";

/**
 * Alta o edición de un cliente desde el mostrador. El alta le emite su
 * tarjeta de lealtad en el mismo paso, así el primer sello ya tiene dónde caer.
 */
export function FormularioCliente({
  cliente,
  onListo,
  onCancelar,
}: {
  cliente?: Cliente;
  onListo: (cliente: Cliente) => void;
  onCancelar: () => void;
}) {
  const store = useBarberia();
  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? "",
    telefono: cliente?.telefono ?? "",
    email: cliente?.email ?? "",
  });
  const [error, setError] = useState("");

  const telefonoLimpio = form.telefono.replace(/[^\d+]/g, "");
  const duplicado = store.clientes.find(
    (c) =>
      c.id !== cliente?.id &&
      ((telefonoLimpio.length >= 8 && c.telefono.replace(/[^\d+]/g, "") === telefonoLimpio) ||
        (form.email.trim() && c.email.trim().toLowerCase() === form.email.trim().toLowerCase()))
  );

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nombre = form.nombre.trim().replace(/\s+/g, " ");
    if (nombre.length < 2) return setError("Escribe el nombre del cliente.");
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("El correo no parece válido.");
    const cambios = { nombre, telefono: form.telefono.trim(), email: form.email.trim() };
    // Clientes que sólo existían por sus citas (sin ficha): se les crea con su mismo id.
    if (cliente && store.clientes.some((c) => c.id === cliente.id)) {
      if (store.actualizarCliente(cliente.id, cambios)) onListo({ ...cliente, ...cambios });
      return;
    }
    if (cliente) {
      onListo(store.registrarCliente({ ...cambios, id: cliente.id }));
      return;
    }
    onListo(store.registrarCliente({ nombre, telefono: form.telefono.trim(), email: form.email.trim() }));
  }

  return (
    <form onSubmit={guardar} className="form-grid">
      <Campo label="Nombre completo" ancho="completo">
        <input
          className="campo-input"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="Ej. Juan Pérez"
          autoComplete="off"
          required
          minLength={2}
        />
      </Campo>
      <Campo label="Teléfono / WhatsApp" ayuda="Para recordatorios y para encontrarlo rápido.">
        <input
          className="campo-input"
          type="tel"
          inputMode="tel"
          value={form.telefono}
          onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          placeholder="55 1234 5678"
          autoComplete="off"
        />
      </Campo>
      <Campo label="Correo (opcional)">
        <input
          className="campo-input"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="cliente@correo.com"
          autoComplete="off"
        />
      </Campo>

      {duplicado && (
        <p className="form-aviso is-full">
          Ya existe <b>{duplicado.nombre}</b> con ese teléfono o correo. Revisa que no lo estés registrando dos veces.
        </p>
      )}
      {!cliente && (
        <p className="form-nota is-full">
          <IdCard className="h-4 w-4 shrink-0" /> Se le emite su tarjeta de lealtad al guardarlo.
        </p>
      )}
      {error && <p className="form-error is-full" role="alert">{error}</p>}

      <div className="form-acciones is-full">
        <button type="button" className="btn-linea" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-gold px-5 py-2.5 text-sm">
          <Check className="h-4 w-4" /> {cliente ? "Guardar cambios" : "Dar de alta"}
        </button>
      </div>
    </form>
  );
}
