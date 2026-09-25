import * as THREE from "three";

/**
 * Construye una malla cerrada barriendo (loft) un perfil cerrado a lo largo de
 * una serie de secciones. Es la base de las piezas que no se pueden representar
 * con primitivas: una hoja de tijera no es un cilindro ni una caja, es un
 * perfil asimétrico —filo en cero, lomo grueso— que se estrecha hacia la punta.
 *
 * `sections` es una lista de anillos; todos deben tener el mismo número de
 * puntos y el mismo sentido de giro. La primera y la última sección se tapan.
 */
export function loft(sections: THREE.Vector3[][], { capStart = true, capEnd = true } = {}) {
  const filas = sections.length;
  const puntos = sections[0].length;

  const posiciones: number[] = [];
  for (const anillo of sections) {
    for (const p of anillo) posiciones.push(p.x, p.y, p.z);
  }

  const indices: number[] = [];
  for (let i = 0; i < filas - 1; i++) {
    for (let j = 0; j < puntos; j++) {
      const j2 = (j + 1) % puntos;
      const a = i * puntos + j;
      const b = i * puntos + j2;
      const c = (i + 1) * puntos + j2;
      const d = (i + 1) * puntos + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Tapas: un vértice en el baricentro del anillo y un abanico de triángulos.
  const agregarTapa = (anillo: THREE.Vector3[], base: number, invertir: boolean) => {
    const centro = new THREE.Vector3();
    for (const p of anillo) centro.add(p);
    centro.divideScalar(anillo.length);
    const idxCentro = posiciones.length / 3;
    posiciones.push(centro.x, centro.y, centro.z);
    for (let j = 0; j < puntos; j++) {
      const j2 = (j + 1) % puntos;
      if (invertir) indices.push(idxCentro, base + j2, base + j);
      else indices.push(idxCentro, base + j, base + j2);
    }
  };

  if (capStart) agregarTapa(sections[0], 0, true);
  if (capEnd) agregarTapa(sections[filas - 1], (filas - 1) * puntos, false);

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return geometria;
}

/**
 * Perfil transversal de una hoja de barbería, en fracciones.
 * `u` va del filo (0) al lomo (1.05); `v` es el semiespesor.
 * El filo tiene espesor cero —es lo que hace que lea como algo que corta— y el
 * lomo es grueso y redondeado.
 */
const PERFIL_HOJA: [number, number][] = [
  [0.0, 0.0],
  [0.08, 0.19],
  [0.26, 0.36],
  [0.5, 0.47],
  [0.76, 0.5],
  [0.92, 0.45],
  [1.0, 0.28],
  [1.05, 0.0],
  [1.0, -0.28],
  [0.92, -0.45],
  [0.76, -0.5],
  [0.5, -0.47],
  [0.26, -0.36],
  [0.08, -0.19],
];

export type ParametrosHoja = {
  /** Largo de la hoja desde el pivote hasta la punta */
  largo: number;
  /** Ancho (filo→lomo) en la base */
  ancho: number;
  /** Espesor máximo en la base */
  espesor: number;
  /** Curvatura de la línea del filo hacia la punta */
  curvatura?: number;
  /** Estaciones a lo largo del largo; más estaciones, punta más fina */
  estaciones?: number;
  /** Desplazamiento en Z de la hoja (las dos mitades se apilan) */
  z?: number;
  /** 1 = lomo hacia +Y, -1 = lomo hacia -Y (la mitad espejada) */
  lado?: 1 | -1;
};

/** Geometría de una hoja completa: base ancha, punta en aguja y filo afilado. */
export function geometriaHoja({
  largo,
  ancho,
  espesor,
  curvatura = 0.075,
  estaciones = 34,
  z = 0,
  lado = 1,
}: ParametrosHoja) {
  const secciones: THREE.Vector3[][] = [];

  for (let i = 0; i < estaciones; i++) {
    const t = i / (estaciones - 1);
    const x = 0.02 + t * largo;

    // Estrechamiento: la hoja conserva cuerpo durante el primer tramo y se
    // afila sólo en el último tercio. Un decaimiento temprano daría una punta
    // de dardo, no de tijera.
    const w = ancho * Math.max(0.03, 1 - 0.965 * Math.pow(t, 2.5));
    const th = espesor * Math.max(0.05, 1 - 0.9 * Math.pow(t, 1.5));

    // La línea del filo cae ligeramente: le da el carácter curvo de la hoja.
    const desvio = -curvatura * largo * t * t;

    const anillo = PERFIL_HOJA.map(([u, v]) => {
      const y = lado * (desvio + u * w);
      return new THREE.Vector3(x, y, z + v * th * 2);
    });
    secciones.push(anillo);
  }

  return loft(secciones);
}

/** Perfil torneado de un remate de poste de barbería (casquillo cromado). */
export function perfilRemate(alto: number, radio: number) {
  const p: THREE.Vector2[] = [];
  const add = (r: number, y: number) => p.push(new THREE.Vector2(r * radio, y * alto));
  add(0.0, 0.0);
  add(0.86, 0.0);
  add(1.0, 0.06);
  add(1.0, 0.2);
  add(0.82, 0.26);
  add(0.86, 0.34);
  add(1.02, 0.42);
  add(1.02, 0.5);
  add(0.78, 0.58);
  add(0.62, 0.7);
  add(0.44, 0.84);
  add(0.22, 0.95);
  add(0.0, 1.0);
  return p;
}
