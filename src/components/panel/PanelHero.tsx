import { BarberPole } from "./BarberPole";

// Cabecera de las páginas raíz de cada rol (panel, agenda, cuenta): la
// misma escena 3D reaparece del lado del producto, con la paleta verde
// pino en vez del navy de la landing — refuerza que es un espacio distinto.
export function PanelHero({
  kicker,
  title,
  lead,
  actions,
}: {
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="panel-hero anim-in mb-6">
      <div className="panel-hero-grid">
        <div className="panel-hero-copy">
          <p className="panel-hero-kicker">{kicker}</p>
          <h1 className="panel-hero-title shimmer-text">{title}</h1>
          {lead && <p className="panel-hero-lead">{lead}</p>}
          {actions && <div className="panel-hero-actions">{actions}</div>}
        </div>
        <div className="panel-hero-stage">
          <BarberPole />
        </div>
      </div>
    </header>
  );
}
