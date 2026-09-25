"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/**
 * Escenario 3D compartido por todas las piezas de la marca.
 *
 * Tres decisiones que sostienen la calidad y el rendimiento:
 *
 * 1. El entorno de reflexión es **procedural**: los `Lightformer` dentro de
 *    `<Environment>` se renderizan a un cubemap en memoria. Se obtienen
 *    reflejos de estudio reales sobre el metal sin descargar ningún HDR
 *    externo (nada de peso extra ni de dominios que la CSP tenga que abrir).
 * 2. El bucle de render se detiene cuando el lienzo sale del viewport, con un
 *    `IntersectionObserver`. Una escena que no se ve no gasta GPU.
 * 3. Sin WebGL o con `prefers-reduced-motion` no se monta nada: se devuelve el
 *    respaldo CSS. Ninguna escena captura el gesto del usuario.
 */
export function Stage({
  children,
  className,
  fallbackClassName,
  camera = [0, 0.1, 5.4],
  fov = 32,
  sombra = true,
  sombraY = -1.35,
}: {
  children: ReactNode;
  className: string;
  fallbackClassName: string;
  camera?: [number, number, number];
  fov?: number;
  sombra?: boolean;
  sombraY?: number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Respeta tanto la preferencia del sistema como el "Menos movimiento" de
    // la barra de accesibilidad, que puede cambiar con la página abierta.
    const evaluar = () => {
      const reducido =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.movimiento === "reducido";
      if (reducido) {
        setSoportado(false);
        return;
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      setSoportado(Boolean(ctx));
    };
    evaluar();
    window.addEventListener("barberia:accesibilidad", evaluar);
    return () => window.removeEventListener("barberia:accesibilidad", evaluar);
  }, []);

  useEffect(() => {
    const el = contenedor.current;
    if (!el || soportado !== true) return;
    const obs = new IntersectionObserver(
      ([entrada]) => setVisible(entrada.isIntersecting),
      { rootMargin: "160px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [soportado]);

  if (soportado !== true) {
    return <div className={`${fallbackClassName} pointer-events-none`} aria-hidden="true" />;
  }

  return (
    <div ref={contenedor} className={`${className} pointer-events-none`} aria-hidden="true">
      <Canvas
        dpr={[1, 1.6]}
        frameloop={visible ? "always" : "demand"}
        camera={{ position: camera, fov }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
        }}
      >
        <RigDeLuz />
        {children}
        {sombra && (
          <ContactShadows
            position={[0, sombraY, 0]}
            opacity={0.5}
            scale={9}
            blur={2.8}
            far={4}
            resolution={256}
            color="#000000"
          />
        )}
      </Canvas>
    </div>
  );
}

/**
 * Rig de estudio de tres luces traducido a paneles de área. Sobre metal, lo
 * que se ve no es la luz sino su reflejo: por eso el entorno lleva paneles
 * alargados —producen los lengüetazos especulares largos característicos del
 * metal pulido— en vez de puntos de luz.
 */
function RigDeLuz() {
  return (
    <>
      <ambientLight intensity={0.16} />
      <Environment resolution={256}>
        {/* Principal cálida, arriba a la derecha */}
        <Lightformer
          form="rect"
          intensity={5.5}
          color="#fff0d2"
          position={[3.2, 3.4, 2.6]}
          rotation={[-Math.PI / 4, Math.PI / 5, 0]}
          scale={[7, 3, 1]}
        />
        {/* Relleno de latón, lateral izquierdo: es la que tiñe el metal */}
        <Lightformer
          form="rect"
          intensity={3.1}
          color="#e6c576"
          position={[-4.2, 0.6, 2.2]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[6, 4, 1]}
        />
        {/* Contraluz oxblood: separa la pieza del fondo negro */}
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#8f3320"
          position={[-1.4, -1.8, -4]}
          rotation={[Math.PI / 2.6, 0, 0]}
          scale={[6, 3, 1]}
        />
        {/* Tira estrecha superior: el brillo largo que recorre el filo */}
        <Lightformer
          form="rect"
          intensity={6}
          color="#ffffff"
          position={[0, 4.2, 0.6]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.7, 9, 1]}
        />
        {/* Panel frontal amplio. Es el más importante de todo el rig: un metal
            pulido sólo se ve si tiene algo luminoso que reflejar hacia la
            cámara. Sin él, sobre fondo negro, la pieza reflejaría negro y
            leería como una silueta plana. */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#f7ecd8"
          position={[0, 0.5, 6.5]}
          rotation={[0, 0, 0]}
          scale={[13, 11, 1]}
        />
        {/* Suelo templado: recoge el metal por abajo sin lavarlo */}
        <Lightformer
          form="rect"
          intensity={0.85}
          color="#4a3a22"
          position={[0, -4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>
      <directionalLight position={[3, 5, 4]} intensity={0.9} color="#fff4dd" />
      <directionalLight position={[-4, -1, 3]} intensity={0.35} color="#e6c576" />
    </>
  );
}

/** Latón pulido de la marca. */
export const MATERIAL_LATON = {
  color: "#c9a057",
  metalness: 1,
  roughness: 0.17,
  clearcoat: 0.55,
  clearcoatRoughness: 0.18,
  envMapIntensity: 1.45,
} as const;

/** Latón mate para piezas secundarias (tornillos, casquillos). */
export const MATERIAL_LATON_MATE = {
  color: "#a8823f",
  metalness: 1,
  roughness: 0.34,
  envMapIntensity: 1.1,
} as const;

/**
 * Acero pulido de la hoja. No es un espejo puro (`metalness: 1`,
 * `roughness: 0`): sobre un fondo negro un espejo perfecto refleja negro y la
 * pieza desaparece. Un pelo de difusión y de rugosidad conserva el aspecto de
 * acero y mantiene la hoja legible.
 */
export const MATERIAL_ACERO = {
  color: "#c8cfd6",
  metalness: 0.94,
  roughness: 0.16,
  clearcoat: 0.35,
  clearcoatRoughness: 0.14,
  envMapIntensity: 1.5,
} as const;
