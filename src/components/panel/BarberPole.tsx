"use client";

import { Stage } from "@/components/three/Stage";
import { PosteBarberia } from "@/components/three/BarberPoleModel";

/**
 * Poste de barbería del hero de producto. Mismo nombre y mismas clases
 * (`.barber-pole-scene` / `.barber-pole-fallback`) que la versión anterior;
 * por dentro, hélices con volumen dentro de una funda de vidrio y remates
 * torneados, en lugar de un cilindro con una textura pintada.
 */
export function BarberPole() {
  return (
    <Stage
      className="barber-pole-scene"
      fallbackClassName="barber-pole-fallback"
      camera={[0, 0, 5.2]}
      fov={36}
      sombra={false}
    >
      <PosteBarberia escala={0.86} />
    </Stage>
  );
}
