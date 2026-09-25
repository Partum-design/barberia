"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
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
  Scissors,
  Settings,
  Sparkles,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import type { Rol, Sesion } from "@/lib/store";
import { Marca } from "@/components/shell/Marca";

type NavItem = { label: string; corto?: string; href: string; icon: React.ReactNode };

const NAV: Record<Rol, NavItem[]> = {
  barbero: [
    { label: "Mi agenda", href: "/dashboard/barbero", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Fichas", href: "/dashboard/barbero/fichas", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Horarios", href: "/dashboard/barbero/horarios", icon: <Clock3 className="h-4 w-4" /> },
    { label: "Configuración", corto: "Ajustes", href: "/dashboard/barbero/configuracion", icon: <Settings className="h-4 w-4" /> },
  ],
  admin: [
    { label: "Panel", href: "/dashboard/admin", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Marketing", href: "/dashboard/admin/marketing", icon: <Megaphone className="h-4 w-4" /> },
    { label: "Clientes", href: "/dashboard/admin/clientes", icon: <Users className="h-4 w-4" /> },
    { label: "Tarjetas de lealtad", corto: "Lealtad", href: "/dashboard/admin/lealtad", icon: <IdCard className="h-4 w-4" /> },
    { label: "Equipo de barberos", corto: "Equipo", href: "/dashboard/admin/equipo", icon: <Scissors className="h-4 w-4" /> },
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

// Shell compartido: escritorio con sidebar fijo y móvil con navegación inferior.
export function PanelShell({
  sesion,
  activo,
  onLogout,
  children,
}: {
  sesion: Sesion;
  activo: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const items = NAV[sesion.rol];
  const inicial = sesion.nombre.replace(/^Dra?\.\s*/, "").charAt(0);

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
            onClick={() => {
              onLogout();
              router.push("/");
            }}
            className="app-logout"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-mobile-header anim-in">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-[0.24em] text-white" style={{ fontFamily: "var(--font-serif)" }}>
            <span className="app-mobile-mark"><Scissors className="h-3.5 w-3.5" /></span>
            <Marca className="max-w-[12rem] truncate uppercase" />
          </Link>
          <button
            onClick={() => {
              onLogout();
              router.push("/");
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-white/70"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </header>

        <div className="app-page">{children}</div>

        {/* Con más de cuatro módulos la rejilla fija de la barra móvil apretaría
            las etiquetas hasta hacerlas ilegibles; a partir de ahí pasa a un
            carril deslizable. */}
        <nav
          className={`app-mobile-nav ${items.length > 4 ? "is-dense" : ""}`}
          aria-label="Navegación móvil"
        >
          {items.map((item) => (
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
        </nav>
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
