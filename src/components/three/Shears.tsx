"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { geometriaHoja, loft } from "./loft";
import { MATERIAL_ACERO, MATERIAL_LATON, MATERIAL_LATON_MATE } from "./Stage";

// ---------------------------------------------------------------------------
// Tijera de barbero
//
// No es un montaje de primitivas: la hoja se genera barriendo un perfil real
// —filo de espesor cero, lomo grueso y redondeado— que se estrecha hasta la
// punta en aguja. El mango es un tubo sobre una curva Catmull-Rom que arranca
// del pivote y termina en el ojo, y el pivote es un tornillo torneado con
// ranura. Las dos mitades giran de verdad sobre el mismo eje.
// ---------------------------------------------------------------------------

const LARGO_HOJA = 2.05;
const ANCHO_HOJA = 0.275;
const ESPESOR_HOJA = 0.062;
const SEPARACION = 0.041; // media distancia entre las dos hojas en Z

/** Mango: tubo de sección variable desde el pivote hasta el ojo. */
function geometriaMango(lado: 1 | -1, z: number) {
  const pts = [
    new THREE.Vector3(0.02, lado * 0.0, z),
    new THREE.Vector3(-0.42, lado * -0.05, z),
    new THREE.Vector3(-0.92, lado * -0.22, z),
    new THREE.Vector3(-1.28, lado * -0.47, z),
    new THREE.Vector3(-1.5, lado * -0.72, z),
  ];
  const curva = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);

  // Barrido manual para poder afinar el radio: grueso en el pivote, delgado
  // en la garganta del mango y otra vez firme al llegar al ojo.
  const estaciones = 48;
  const lados = 14;
  const secciones: THREE.Vector3[][] = [];
  const marcos = curva.computeFrenetFrames(estaciones - 1, false);

  for (let i = 0; i < estaciones; i++) {
    const t = i / (estaciones - 1);
    const punto = curva.getPointAt(t);
    const normal = marcos.normals[i];
    const binormal = marcos.binormals[i];
    const r = 0.135 - 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.025 * t;
    const anillo: THREE.Vector3[] = [];
    for (let j = 0; j < lados; j++) {
      const a = (j / lados) * Math.PI * 2;
      // Sección ligeramente ovalada: el mango es plano, no un cilindro.
      const dx = Math.cos(a) * r * 1.18;
      const dy = Math.sin(a) * r * 0.66;
      anillo.push(
        new THREE.Vector3(
          punto.x + normal.x * dx + binormal.x * dy,
          punto.y + normal.y * dx + binormal.y * dy,
          punto.z + normal.z * dx + binormal.z * dy
        )
      );
    }
    secciones.push(anillo);
  }
  return loft(secciones);
}

function MitadTijera({
  lado,
  refGrupo,
}: {
  lado: 1 | -1;
  refGrupo: React.RefObject<THREE.Group | null>;
}) {
  const z = lado === 1 ? SEPARACION : -SEPARACION;

  const hoja = useMemo(
    () => geometriaHoja({ largo: LARGO_HOJA, ancho: ANCHO_HOJA, espesor: ESPESOR_HOJA, z, lado }),
    [z, lado]
  );
  const mango = useMemo(() => geometriaMango(lado, z), [lado, z]);

  const radioOjo = lado === 1 ? 0.3 : 0.265;
  const centroOjo: [number, number, number] = [-1.75, lado * -0.92, z];

  return (
    <group ref={refGrupo}>
      {/* Hoja */}
      <mesh geometry={hoja} castShadow>
        <meshPhysicalMaterial {...MATERIAL_ACERO} />
      </mesh>

      {/* Refuerzo del pivote (virola): donde la hoja se ensancha antes del eje */}
      <mesh position={[0.02, lado * 0.055, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.155, 0.155, ESPESOR_HOJA * 2.1, 40]} />
        <meshPhysicalMaterial {...MATERIAL_ACERO} roughness={0.15} />
      </mesh>

      {/* Mango */}
      <mesh geometry={mango} castShadow>
        <meshPhysicalMaterial {...MATERIAL_LATON} />
      </mesh>

      {/* Ojo: toro achatado, no una circunferencia perfecta */}
      <group position={centroOjo} rotation={[0, 0, lado * -0.34]}>
        <mesh scale={[1.16, 1, 0.6]} castShadow>
          <torusGeometry args={[radioOjo, 0.082, 20, 72]} />
          <meshPhysicalMaterial {...MATERIAL_LATON} />
        </mesh>
        {/* Aro interior de contraste, como el inserto de silicona de las
            tijeras profesionales */}
        <mesh scale={[1.16, 1, 0.4]}>
          <torusGeometry args={[radioOjo - 0.05, 0.022, 14, 64]} />
          <meshPhysicalMaterial {...MATERIAL_LATON_MATE} color="#3a2a15" metalness={0.2} roughness={0.6} />
        </mesh>
      </group>

      {/* Apoyo de meñique: sólo la mitad inferior lo lleva, como en las
          tijeras de barbero reales */}
      {lado === -1 && (
        <mesh position={[-1.66, 0.62, z]} rotation={[Math.PI / 2, 0, 0.5]} castShadow>
          <torusGeometry args={[0.2, 0.038, 14, 40, Math.PI * 1.15]} />
          <meshPhysicalMaterial {...MATERIAL_LATON} />
        </mesh>
      )}
    </group>
  );
}

/** Tornillo pivote torneado, con cabeza, ranura y arandela. */
function Pivote() {
  return (
    <group position={[0.02, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.22, 28]} />
        <meshPhysicalMaterial {...MATERIAL_LATON_MATE} />
      </mesh>
      {[0.1, -0.1].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.098, 0.086, 0.036, 32]} />
            <meshPhysicalMaterial {...MATERIAL_LATON} roughness={0.22} />
          </mesh>
          {/* Ranura del destornillador */}
          <mesh position={[0, 0, z > 0 ? 0.017 : -0.017]}>
            <boxGeometry args={[0.15, 0.02, 0.006]} />
            <meshStandardMaterial color="#20180c" roughness={0.85} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Conjunto completo. Las mitades abren y cierran sobre el pivote real; el
 * recorrido es corto y muy lento, que es como se mueve una herramienta cara.
 */
export function Tijeras({ escala = 0.76 }: { escala?: number }) {
  const superior = useRef<THREE.Group>(null);
  const inferior = useRef<THREE.Group>(null);
  const conjunto = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Apertura amplia: es lo que hace legible que son dos hojas cruzadas y no
    // una sola pieza.
    const abertura = 0.245 + Math.sin(t * 0.62) * 0.115;
    if (superior.current) superior.current.rotation.z = abertura;
    if (inferior.current) inferior.current.rotation.z = -abertura;
    if (conjunto.current) {
      conjunto.current.rotation.y = Math.sin(t * 0.28) * 0.3;
      conjunto.current.rotation.x = Math.sin(t * 0.21) * 0.09;
    }
  });

  return (
    <Float speed={1.05} rotationIntensity={0.14} floatIntensity={0.5}>
      <group ref={conjunto} scale={escala} rotation={[0, 0, 0.66]} position={[0.28, -0.06, 0]}>
        <MitadTijera lado={1} refGrupo={superior} />
        <MitadTijera lado={-1} refGrupo={inferior} />
        <Pivote />
      </group>
    </Float>
  );
}

/**
 * Navaja de afeitar: hoja con contrafilo y mango de dos cachas. Acompaña a la
 * tijera en el hero, más pequeña y más lenta, para dar profundidad sin
 * competir con la pieza principal.
 */
export function Navaja({ escala = 0.5 }: { escala?: number }) {
  const grupo = useRef<THREE.Group>(null);

  const hoja = useMemo(
    () =>
      geometriaHoja({
        largo: 1.45,
        ancho: 0.34,
        espesor: 0.05,
        curvatura: 0.02,
        estaciones: 26,
        lado: 1,
      }),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!grupo.current) return;
    grupo.current.rotation.y = -0.5 + Math.sin(t * 0.2) * 0.4;
    grupo.current.rotation.z = 0.3 + Math.sin(t * 0.16) * 0.08;
  });

  return (
    <Float speed={0.8} rotationIntensity={0.2} floatIntensity={0.8}>
      <group ref={grupo} scale={escala}>
        <mesh geometry={hoja} castShadow>
          <meshPhysicalMaterial {...MATERIAL_ACERO} roughness={0.06} />
        </mesh>
        {/* Espiga y pivote */}
        <mesh position={[-0.06, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.07, 24]} />
          <meshPhysicalMaterial {...MATERIAL_LATON} />
        </mesh>
        {/* Mango: dos cachas separadas, la hoja se pliega entre ellas */}
        {[0.062, -0.062].map((z) => (
          <mesh key={z} position={[-0.86, 0.2, z]} rotation={[0, 0, 0.16]} castShadow>
            <boxGeometry args={[1.6, 0.2, 0.038]} />
            <meshPhysicalMaterial color="#1c150c" metalness={0.35} roughness={0.42} clearcoat={0.8} />
          </mesh>
        ))}
        <mesh position={[-1.62, 0.31, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.155, 20]} />
          <meshPhysicalMaterial {...MATERIAL_LATON} />
        </mesh>
      </group>
    </Float>
  );
}
