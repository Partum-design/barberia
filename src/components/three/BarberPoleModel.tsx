"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { perfilRemate } from "./loft";
import { MATERIAL_LATON, MATERIAL_LATON_MATE } from "./Stage";

// ---------------------------------------------------------------------------
// Poste de barbería
//
// Las franjas no están pintadas sobre un cilindro: son hélices de verdad,
// tubos con volumen que giran dentro de una funda de vidrio. Los remates están
// torneados con un perfil de revolución, no son esferas. Es la diferencia
// entre un poste y algo que parece un poste.
// ---------------------------------------------------------------------------

const ALTO = 2.2;
const RADIO_HELICE = 0.345;
const VUELTAS = 4.3;

function curvaHelice(desfase: number) {
  const puntos: THREE.Vector3[] = [];
  const n = 170;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * VUELTAS * Math.PI * 2 + desfase;
    puntos.push(
      new THREE.Vector3(
        Math.cos(a) * RADIO_HELICE,
        -ALTO / 2 + t * ALTO,
        Math.sin(a) * RADIO_HELICE
      )
    );
  }
  return new THREE.CatmullRomCurve3(puntos);
}

function Franjas() {
  const cilindro = useRef<THREE.Group>(null);

  const helices = useMemo(
    () =>
      [
        { color: "#5f1d10", rugosidad: 0.5, metal: 0.12, desfase: 0 },
        { color: "#ece2cf", rugosidad: 0.44, metal: 0.04, desfase: (Math.PI * 2) / 3 },
        { color: "#c9a057", rugosidad: 0.22, metal: 0.9, desfase: (Math.PI * 4) / 3 },
      ].map((franja) => ({
        ...franja,
        geometria: new THREE.TubeGeometry(curvaHelice(franja.desfase), 220, 0.078, 14, false),
      })),
    []
  );

  // El giro sobre el eje vertical es lo que produce la ilusión de que las
  // franjas ascienden sin fin. Lento: un poste real gira despacio.
  useFrame((_, delta) => {
    if (cilindro.current) cilindro.current.rotation.y -= delta * 0.75;
  });

  return (
    <group ref={cilindro}>
      {/* Núcleo marfil sobre el que se apoyan las hélices */}
      <mesh>
        <cylinderGeometry args={[0.288, 0.288, ALTO, 48]} />
        <meshPhysicalMaterial color="#efe6d4" roughness={0.45} metalness={0.05} clearcoat={0.4} />
      </mesh>
      {helices.map((h) => (
        <mesh key={h.desfase} geometry={h.geometria} castShadow>
          <meshPhysicalMaterial
            color={h.color}
            roughness={h.rugosidad}
            metalness={h.metal}
            clearcoat={0.7}
            clearcoatRoughness={0.2}
            envMapIntensity={1.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Remate torneado: casquillo, garganta y cúpula, girados sobre el eje. */
function Remate({ y, invertido = false }: { y: number; invertido?: boolean }) {
  const geometria = useMemo(() => new THREE.LatheGeometry(perfilRemate(0.44, 0.46), 56), []);
  return (
    <mesh position={[0, y, 0]} rotation={[invertido ? Math.PI : 0, 0, 0]} castShadow>
      <primitive object={geometria} attach="geometry" />
      <meshPhysicalMaterial {...MATERIAL_LATON} roughness={0.12} clearcoat={0.9} />
    </mesh>
  );
}

export function PosteBarberia({ escala = 0.78 }: { escala?: number }) {
  const grupo = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!grupo.current) return;
    grupo.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.22;
  });

  return (
    <Float speed={0.95} rotationIntensity={0.08} floatIntensity={0.45}>
      <group ref={grupo} scale={escala} rotation={[0, 0, 0.075]}>
        <Franjas />

        {/* Funda de vidrio. Sin `transmission`, que obliga a un pase de render
            aparte: un físico muy pulido y casi transparente da el mismo
            resultado a una fracción del coste. */}
        <mesh>
          <cylinderGeometry args={[0.44, 0.44, ALTO + 0.02, 64, 1, true]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.11}
            roughness={0.03}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.02}
            envMapIntensity={2.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Aros de sujeción del vidrio */}
        {[ALTO / 2 - 0.015, -ALTO / 2 + 0.015].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <torusGeometry args={[0.445, 0.024, 16, 64]} />
            <meshPhysicalMaterial {...MATERIAL_LATON} />
          </mesh>
        ))}

        <Remate y={ALTO / 2} />
        <Remate y={-ALTO / 2} invertido />

        {/* Brazo de pared, detrás de la pieza: da razón de ser al montaje sin
            competir con el poste en la silueta */}
        <group position={[0, 0, -0.72]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.58, 20]} />
            <meshPhysicalMaterial {...MATERIAL_LATON_MATE} />
          </mesh>
          <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.06, 32]} />
            <meshPhysicalMaterial {...MATERIAL_LATON} />
          </mesh>
        </group>
      </group>
    </Float>
  );
}
