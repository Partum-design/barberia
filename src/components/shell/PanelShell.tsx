"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Boxes,
  ExternalLink,
  Grid2x2,
  X,
  CalendarDays,
  ClipboardList,
  Clock3,
  IdCard,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PieChart,
  Plug,
  ScanLine,
  Scissors,
  Settings,
  Sparkles,
  Tags,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { Rol, Sesion } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";

type NavItem = { label: string; corto?: string; href: string; icon: React.ReactNode };

const NAV: Record<Rol, NavItem[]> = {
  barbero: [
    { label: "Mi agenda", href: "/dashboard/barbero", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Confirmar cita", corto: "Escanear", href: "/dashboard/barbero/confirmar", icon: <ScanLine className="h-4 w-4" /> },
    { label: "Fichas", href: "/dashboard/barbero/fichas", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Horarios", href: "/dashboard/barbero/horarios", icon: <Clock3 className="h-4 w-4" /> },
    { label: "Configuración", corto: "Ajustes", href: "/dashboard/barbero/configuracion", icon: <Settings className="h-4 w-4" /> },
  ],
  admin: [
    { label: "Panel", href: "/dashboard/admin", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Citas", href: "/dashboard/admin/citas", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Confirmar cita", corto: "Escanear", href: "/dashboard/admin/confirmar", icon: <ScanLine className="h-4 w-4" /> },
    { label: "Marketing", href: "/dashboard/admin/marketing", icon: <Megaphone className="h-4 w-4" /> },
    { label: "Clientes", href: "/dashboard/admin/clientes", icon: <Users className="h-4 w-4" /> },
    { label: "Tarjetas de lealtad", corto: "Lealtad", href: "/dashboard/admin/lealtad", icon: <IdCard className="h-4 w-4" /> },
    { label: "Usuarios", href: "/dashboard/admin/usuarios", icon: <UserCog className="h-4 w-4" /> },
    { label: "Equipo de barberos", corto: "Equipo", href: "/dashboard/admin/equipo", icon: <Scissors className="h-4 w-4" /> },
    { label: "Disponibilidad", corto: "Horarios", href: "/dashboard/admin/disponibilidad", icon: <Clock3 className="h-4 w-4" /> },
    { label: "Servicios", href: "/dashboard/admin/servicios", icon: <Tags className="h-4 w-4" /> },
    { label: "Inventario", href: "/dashboard/admin/inventario", icon: <Boxes className="h-4 w-4" /> },
    { label: "Caja y finanzas", corto: "Caja", href: "/dashboard/admin/caja", icon: <Wallet className="h-4 w-4" /> },
    { label: "Reportes", href: "/dashboard/admin/reportes", icon: <PieChart className="h-4 w-4" /> },
    { label: "Integraciones", corto: "Conexiones", href: "/dashboard/admin/integraciones", icon: <Plug className="h-4 w-4" /> },
    { label: "Configuración", corto: "Ajustes", href: "/dashboard/admin/configuracion", icon: <Settings className="h-4 w-4" /> },
  ],
  cliente: [
    { label: "Mi cuenta", href: "/cuenta", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Agendar cita", corto: "Agendar", href: "/reservar", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Mi tarjeta", href: "/cuenta/tarjeta", icon: <IdCard className="h-4 w-4" /> },
    { label: "Pagos", href: "/cuenta/pagos", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Recompensas", href: "/cuenta/recompensas", icon: <Sparkles className="h-4 w-4" /> },
  ],
};

// En el teléfono la barra inferior lleva sólo los accesos del día a día; el
// resto vive en "Más", una hoja con botones grandes.
const PRINCIPALES_MOVIL: Record<Rol, string[]> = {
  admin: ["Panel", "Citas", "Confirmar cita", "Clientes"],
  barbero: ["Mi agenda", "Confirmar cita", "Fichas", "Horarios"],
  cliente: ["Mi cuenta", "Agendar cita", "Mi tarjeta", "Recompensas"],
};

// Shell compartido: escritorio con sidebar fijo y móvil con navegación inferior.
export function PanelShell({
  sesion,
  activo,
  onLogout,
  children,
}: {
  sesion: Sesion;
  activo: string;
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const items = NAV[sesion.rol];
  const inicial = sesion.nombre.replace(/^Dra?\.\s*/, "").charAt(0);
  const [masAbierto, setMasAbierto] = useState(false);
  const principales = items.filter((i) => PRINCIPALES_MOVIL[sesion.rol].includes(i.label));
  // "Más" siempre está: además de las secciones guarda la salida y la accesibilidad.
  const hayMas = true;
  const activoEnMas = !principales.some((i) => i.label === activo);

  // La hoja "Más" se cierra con Escape y bloquea el scroll de fondo.
  useEffect(() => {
    if (!masAbierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setMasAbierto(false);
    window.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [masAbierto]);

  const salir = async () => {
    await onLogout();
    router.push("/");
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar anim-in">
        <Link href="/" className="app-brand">
          <span className="app-brand-mark">
            <span className="app-brand-pulse" />
            <Scissors className="h-4 w-4" />
          </span>
          <span className="leading-none">
            <Marca className="block max-w-[10rem] truncate text-sm font-semibold uppercase tracking-[0.2em] text-white" />
            <span className="block text-[9px] uppercase tracking-[0.3em] text-white/40">
              Panel de gestión
            </span>
          </span>
        </Link>

        <p className="app-nav-label">Espacio de trabajo</p>
        <nav className="app-nav" aria-label="Navegación principal">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.label === activo ? "page" : undefined}
              className={`app-nav-item ${item.label === activo ? "is-active" : ""}`}
            >
              <span className="app-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="app-user-card">
          <div className="flex items-center gap-3">
            <div className="app-user-avatar">{inicial}</div>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-white">{sesion.nombre}</p>
              <p className="truncate text-[11px] text-white/48">{sesion.subtitulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("accesibilidad:abrir"))}
            className="app-logout"
          >
            <Accessibility className="h-4 w-4" /> Accesibilidad
          </button>
          <button onClick={salir} className="app-logout">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-mobile-header anim-in">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-[0.24em] text-white" style={{ fontFamily: "var(--font-serif)" }}>
            <span className="app-mobile-mark"><Scissors className="h-3.5 w-3.5" /></span>
            <Marca className="max-w-[11rem] truncate uppercase" />
          </Link>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("accesibilidad:abrir"))}
            className="app-mobile-a11y"
            aria-label="Accesibilidad"
          >
            <Accessibility className="h-5 w-5" />
          </button>
        </header>

        <div className="app-page">{children}</div>

        <nav className="app-mobile-nav" aria-label="Navegación móvil">
          {principales.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.label === activo ? "page" : undefined}
              className={`app-mobile-item ${item.label === activo ? "is-active" : ""}`}
            >
              {item.icon}
              <span>{item.corto ?? item.label}</span>
            </Link>
          ))}
          {hayMas && (
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              aria-expanded={masAbierto}
              className={`app-mobile-item ${activoEnMas ? "is-active" : ""}`}
            >
              <Grid2x2 className="h-4 w-4" />
              <span>Más</span>
            </button>
          )}
        </nav>

        {masAbierto && (
          <div className="app-sheet" role="dialog" aria-modal="true" aria-label="Todas las secciones">
            <button type="button" className="app-sheet-fondo" aria-label="Cerrar" onClick={() => setMasAbierto(false)} />
            <div className="app-sheet-panel">
              <span className="app-sheet-asa" aria-hidden />
              <div className="app-sheet-head">
                <div className="app-user-avatar">{inicial}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{sesion.nombre}</p>
                  <p className="truncate text-sm text-white/60">{sesion.subtitulo}</p>
                </div>
                <button type="button" className="app-sheet-cerrar" onClick={() => setMasAbierto(false)} aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="app-sheet-grid">
                {items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMasAbierto(false)}
                    aria-current={item.label === activo ? "page" : undefined}
                    className={`app-sheet-item ${item.label === activo ? "is-active" : ""}`}
                  >
                    <span className="app-sheet-icono">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="app-sheet-extra">
                <Link href="/" onClick={() => setMasAbierto(false)}>
                  <ExternalLink className="h-4 w-4" /> Ver página pública
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMasAbierto(false);
                    window.dispatchEvent(new Event("accesibilidad:abrir"));
                  }}
                >
                  <Accessibility className="h-4 w-4" /> Accesibilidad
                </button>
                <button type="button" onClick={salir} className="is-danger">
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// KPI basado en la misma escala de seis tonos de la marca.
export function KpiPastel({
  icon,
  label,
  value,
  nota,
  tono,
  delay = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  nota?: string;
  tono: "lila" | "azul" | "menta" | "durazno";
  delay?: string;
}) {
  const fondos = {
    lila: "kpi-slate",
    azul: "kpi-cyan",
    menta: "kpi-mint",
    durazno: "kpi-fog",
  } as const;
  return (
    <div className={`anim-in ${delay} kpi-card ${fondos[tono]}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="kpi-card-icon">
          {icon}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>{label}</span>
      </div>
      <p className="font-num text-2xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--ink)" }}>{value}</p>
      {nota && <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{nota}</p>}
    </div>
  );
}
