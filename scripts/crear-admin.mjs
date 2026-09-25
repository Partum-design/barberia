#!/usr/bin/env node
// Crea (o promueve) una cuenta de administrador en Supabase Auth.
//
//   npm run crear-admin
//
// Sirve para la primera cuenta, cuando todavía no hay nadie que pueda darla de
// alta desde el panel. Lee las llaves de .env.local y pide los datos por
// consola; la contraseña no se muestra mientras se escribe.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

function leerEnv() {
  const env = {};
  for (const archivo of [".env.local", ".env"]) {
    let texto;
    try {
      texto = readFileSync(archivo, "utf8");
    } catch {
      continue;
    }
    for (const linea of texto.split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

function preguntar(texto, { oculto = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => {
        if (s.includes(texto)) rl.output.write(s);
        else if (!s.includes("\n")) rl.output.write("*");
      };
    }
    rl.question(texto, (r) => {
      rl.close();
      if (oculto) process.stdout.write("\n");
      resolve(r.trim());
    });
  });
}

const env = leerEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const llave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const nombre = await preguntar("Nombre: ");
const email = (await preguntar("Correo: ")).toLowerCase();
const password = await preguntar("Contraseña (mín. 8): ", { oculto: true });

if (!nombre || !email.includes("@") || password.length < 8) {
  console.error("Datos incompletos: nombre, correo válido y contraseña de 8+ caracteres.");
  process.exit(1);
}

const headers = { apikey: llave, Authorization: `Bearer ${llave}`, "Content-Type": "application/json" };
const cuerpo = {
  email,
  password,
  email_confirm: true,
  app_metadata: { rol: "admin" },
  user_metadata: { full_name: nombre },
};

let res = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers, body: JSON.stringify(cuerpo) });

if (res.status === 422 || res.status === 409) {
  // Ya existe: se busca y se promueve a admin con la contraseña nueva.
  const lista = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers }).then((r) => r.json());
  const usuario = (lista.users ?? []).find((u) => u.email?.toLowerCase() === email);
  if (!usuario) {
    console.error("El correo ya está registrado pero no se encontró la cuenta.");
    process.exit(1);
  }
  res = await fetch(`${url}/auth/v1/admin/users/${usuario.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password, app_metadata: { rol: "admin" }, user_metadata: { full_name: nombre } }),
  });
}

if (!res.ok) {
  console.error("No se pudo crear la cuenta:", await res.text());
  process.exit(1);
}
console.log(`Listo: ${email} ya puede entrar como administrador en /login`);
