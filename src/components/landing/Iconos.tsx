// Ilustraciones de oficio para la portada: trazo grueso, una sola tinta
// (currentColor) para que se tiñan con el acento de la sección.

type P = { className?: string };

export function Tijeras({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
      <circle cx="14" cy="46" r="8" />
      <circle cx="30" cy="54" r="8" />
      <path d="M20 41 58 8M35 47 58 8" />
      <circle cx="31" cy="34" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Navaja({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M8 40 40 8l8 8-26 26z" />
      <path d="M22 42 34 54c2 2 6 2 8 0l2-2c2-2 2-6 0-8L40 40" />
      <path d="M14 34l6 6" />
    </svg>
  );
}

export function Peine({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
      <rect x="6" y="14" width="52" height="12" rx="3" />
      {[12, 18, 24, 30, 36, 42, 48, 54].map((x) => (
        <path key={x} d={`M${x} 26v${x > 30 ? 18 : 24}`} />
      ))}
    </svg>
  );
}

export function Brocha({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 30c-4-10 0-24 12-24s16 14 12 24z" />
      <path d="M22 30h20l-3 8H25z" />
      <path d="M26 38h12v16a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z" />
      <path d="M26 46h12" />
    </svg>
  );
}

export function Maquina({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 6h24v8H20z" />
      <path d="M18 14h28l-2 40a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" />
      <path d="M26 26h12M26 34h12" />
      <circle cx="32" cy="46" r="3" />
    </svg>
  );
}

export function Navajazo({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
      <path d="M10 50c10-4 18-14 22-26s10-16 22-16" />
      <path d="M10 36c8-2 12-8 14-14M30 56c8-2 16-8 20-18" />
    </svg>
  );
}
