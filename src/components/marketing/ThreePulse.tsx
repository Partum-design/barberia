"use client";

import { Stage } from "@/components/three/Stage";
import { Tijeras } from "@/components/three/Shears";

/**
 * Pieza 3D del hero de marketing: la tijera de barbero, modelada a partir de
 * perfiles reales y flotando lentamente mientras abre y cierra sobre su
 * pivote.
 *
 * Una sola pieza, bien iluminada, en vez de un bodegón de objetos pequeños:
 * a este tamaño en pantalla, un segundo objeto compite con el titular y
 * ninguno de los dos se lee.
 *
 * Conserva el nombre y el contrato del componente anterior (sin props, mismas
 * clases `.three-pulse` / `.three-pulse-fallback`) para que ninguna página que
 * lo use tenga que cambiar.
 */
export function ThreePulse() {
  return (
    <Stage
      className="three-pulse"
      fallbackClassName="three-pulse three-pulse-fallback"
      camera={[0, 0.15, 5.9]}
      fov={34}
      sombraY={-1.7}
    >
      <group position={[-0.1, 0.15, 0]}>
        <Tijeras escala={0.62} />
      </group>
    </Stage>
  );
}
