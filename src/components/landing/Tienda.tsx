"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, ShoppingBag } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import type { Producto } from "@/lib/store";
import { Brocha, Navaja, Peine, Tijeras } from "@/components/landing/Iconos";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const ICONO: Record<Producto["categoria"], typeof Peine> = {
  Peinado: Peine,
  Cuidado: Brocha,
  Afeitado: Navaja,
  Consumible: Tijeras,
};

/** WhatsApp pide lada de país: a un número de 10 dígitos le antepone el 52 de México. */
function enlaceWhatsApp(numero: string, texto: string) {
  const d = numero.replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}?text=${encodeURIComponent(texto)}`;
}

/** Tarjeta de producto: foto grande, marca, nombre, precio y apartar por WhatsApp. */
export function TarjetaProducto({ producto: p, whatsapp, indice = 0 }: { producto: Producto; whatsapp: string; indice?: number }) {
  const agotado = p.existencias <= 0;
  const Icono = ICONO[p.categoria] ?? Peine;
  const wa = enlaceWhatsApp(whatsapp, `Hola, quiero apartar «${p.nombre}» (${mxn.format(p.precio_venta)}). ¿Lo tienen disponible?`);
  return (
    <Reveal delay={(indice % 4) * 80} className="cm-prod-wrap">
      <article className={`cm-prod ${agotado ? "is-agotado" : ""}`}>
        <div className="cm-prod-foto">
          {p.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagen_url} alt={p.nombre} loading="lazy" decoding="async" />
          ) : (
            <div className="cm-prod-sinfoto" aria-hidden>
              <Icono />
            </div>
          )}
          <span className="cm-prod-cat">{p.categoria}</span>
          {agotado && <span className="cm-prod-agotado">Agotado</span>}
        </div>
        <div className="cm-prod-cuerpo">
          {p.marca && <p className="cm-prod-marca">{p.marca}</p>}
          <h3>{p.nombre}</h3>
          {p.descripcion && <p className="cm-prod-desc">{p.descripcion}</p>}
          <div className="cm-prod-pie">
            <b className="cm-prod-precio">{mxn.format(p.precio_venta)}</b>
            {agotado ? (
              <span className="cm-prod-nota">Pregunta cuándo llega</span>
            ) : wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cm-prod-cta" aria-label={`Apartar ${p.nombre} por WhatsApp`}>
                <MessageCircle aria-hidden /> Apartar
              </a>
            ) : (
              <span className="cm-prod-nota">En barbería</span>
            )}
          </div>
        </div>
      </article>
    </Reveal>
  );
}

/**
 * Tienda de la página: lo que el administrador marcó como visible en
 * Inventario. En la portada se ven los primeros y un enlace a /productos;
 * en /productos, todos con filtro por categoría.
 */
export function Tienda({
  productos,
  whatsapp,
  completa = false,
}: {
  productos: Producto[];
  whatsapp: string;
  completa?: boolean;
}) {
  const [filtro, setFiltro] = useState<string>("Todo");
  const ordenados = useMemo(
    // Primero lo que hay, luego lo agotado; dentro, los que tienen foto.
    () =>
      [...productos].sort(
        (a, b) =>
          Number(b.existencias > 0) - Number(a.existencias > 0) ||
          Number(Boolean(b.imagen_url)) - Number(Boolean(a.imagen_url)) ||
          a.nombre.localeCompare(b.nombre)
      ),
    [productos]
  );
  const categorias = ["Todo", ...new Set(ordenados.map((p) => p.categoria))];
  const visibles = completa
    ? filtro === "Todo"
      ? ordenados
      : ordenados.filter((p) => p.categoria === filtro)
    : ordenados.slice(0, 4);

  if (productos.length === 0) return null;

  return (
    <>
      {completa && categorias.length > 2 && (
        <div className="cm-prod-filtros" role="tablist" aria-label="Filtrar productos">
          {categorias.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={filtro === c} className={filtro === c ? "is-on" : ""} onClick={() => setFiltro(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="cm-prods">
        {visibles.map((p, i) => (
          <TarjetaProducto key={p.id} producto={p} whatsapp={whatsapp} indice={i} />
        ))}
      </div>
      {!completa && (
        <div className="cm-prod-mas">
          <Link href="/productos" className="cm-btn">
            <ShoppingBag /> Ver toda la tienda {productos.length > 4 ? `(${productos.length})` : ""} <ArrowRight />
          </Link>
        </div>
      )}
    </>
  );
}
