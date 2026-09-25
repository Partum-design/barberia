# Plan de rediseño y ampliación — HAIRCUT Barbershop OS

Documento de planeación que precede a la implementación. Cubre (1) la investigación de
referencia, (2) el sistema de diseño derivado de esa investigación, (3) la corrección de
las tarjetas digitales de pago, (4) el nuevo acceso al sistema, (5) el panel de marketing
con Google Analytics y Google Ads, y (6) los módulos de negocio que completan la
plataforma.

Principio rector: **no se descarta nada de lo existente**. Todo el rediseño se aplica
sobre las mismas rutas, los mismos nombres de clase y el mismo almacén de datos; lo que
cambia es la capa visual y lo que se añade son módulos nuevos.

---

## 1. Investigación

### 1.1 Qué funciona en sitios de barbería premium

Revisión de recopilaciones de referencia del sector (Colorlib, CyberOptik, Slider
Revolution, The Salon Business, Kreafolk, DesignMantic). Conclusiones consistentes entre
fuentes:

| Hallazgo | Fuente convergente | Cómo lo aplicamos |
|---|---|---|
| Negro + oro es el binomio que lee como "barbería cara"; el negro sólo, como genérico | Colorlib, CyberOptik, Kreafolk | Base onyx cálido + rampa de latón pulido como acento único de acción |
| El rojo profundo / oxblood es el marcador de herencia del oficio (poste de barbero) | Kreafolk, DesignMantic | Acento secundario oxblood, reservado a motivos de marca y al 3D, nunca a estados |
| Tipografía editorial (serif de contraste alto) + rotulación condensada de letrero | Slider Revolution, The Salon Business | Serif de titulares + condensada versalita para etiquetas y rótulos |
| Fotografía y superficies oscuras hacen que la galería y el producto se lean como moda, no como servicio | The Salon Business | Superficies estratificadas con grano, viñeta y filete de luz |
| Un acabado pulido es lo que justifica el precio premium del servicio | CyberOptik | Detalle de bisel, hairlines de latón y 3D con reflexión real |
| Los motivos gráficos del oficio (poste, tijeras, navaja, chevrón) funcionan como ornamento, no como ilustración literal | DesignMantic, Kreafolk | Chevrón de poste como divisor/ornamento art déco; 3D modelado con precisión |

### 1.2 Qué evitar

- Degradados multicolor y neones: rompen la lectura premium.
- Oro plano (#FFD700): lee a plástico. Se necesita una rampa con luz especular.
- Ilustración 3D de baja poligonización o "primitivas apiladas": es exactamente el error
  que hoy tiene el proyecto (un icosaedro en alambre y un cilindro con textura pintada).
- Modo claro forzado: la marca vive en oscuro; el modo claro se descarta explícitamente.

### 1.3 Integraciones — decisiones técnicas

- **GA4**: la API de reporting es `Google Analytics Data API v1` (`runReport`). Auth por
  cuenta de servicio con scope `analytics.readonly`.
- **Google Ads**: `googleAds:searchStream` con GAQL, cabeceras `developer-token` y
  `login-customer-id`, auth por refresh token OAuth de usuario.
- **Sin dependencias nuevas**: ambos se resuelven con `fetch` y firma RS256 con el módulo
  `crypto` de Node. Evita arrastrar `google-auth-library`, `googleapis` y `grpc` al bundle
  del servidor (≈40 MB) para dos llamadas HTTP.
- **Meta Ads**: se deja el adaptador declarado en el mismo contrato pero desactivado. El
  encargo es Google Ads; Meta queda listo para encenderse sin refactor.

---

## 2. Sistema de diseño — "Onyx Atelier"

Evolución de la paleta actual (que ya era onyx + oro), no un reemplazo.

### 2.1 Color

```
Onyx        #060504  #0a0806  #100d09  #17130c  #1e1911   superficies (0→4)
Latón       #f5e4bd  #e6c576  #cfa651  #b7924d  #8a6c33   acento primario / acción
Oxblood     #b0453a  #8f3320  #6b2418                     herencia de oficio (ornamento)
Hueso       #f6f0e4  rgba(246,240,228,.62) .40 .24        texto
Verdigris   #5cc08d                                        éxito, exclusivo de estados
Ámbar       #d9a441                                        advertencia
```

Reglas:
- El latón sólo aparece en lo accionable, en datos destacados y en hairlines.
- El oxblood nunca es un estado; es marca (poste, chevrón, escena 3D).
- Todo texto de cuerpo sobre onyx usa hueso al 62 % mínimo (contraste ≥ 7:1 sobre `#0a0806`).

### 2.2 Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Editorial | **Playfair Display** | Logotipo HAIRCUT y titulares de marketing |
| Rótulo | **Bebas Neue** | Eyebrows, etiquetas, versalitas, cifras de letrero |
| Interfaz | **Plus Jakarta Sans** | Cuerpo y UI de producto |
| Datos | **IBM Plex Mono** | Cifras tabulares, importes, horarios |
| Display | **Outfit** | Titulares de producto (se conserva) |

Se conservan las variables CSS existentes (`--font-display`, `--font-serif`, `--font-body`,
`--font-num`) y se añade `--font-sign`, de modo que ninguna regla previa se rompe.

### 2.3 Materia

- **Grano**: textura de ruido en `::after` del `body`, 3 % de opacidad, `pointer-events:none`.
  Rompe el banding de los degradados oscuros.
- **Filete de luz**: `inset 0 1px 0 rgba(246,240,228,.06)` en cada superficie elevada.
- **Hairline de latón**: divisores de 1 px con degradado transparente→latón→transparente.
- **Chevrón de poste**: patrón diagonal repetido, disponible como `.rule-chevron` y como
  cinta ornamental de sección.
- **Elevación**: cuatro niveles de sombra definidos como variables, en lugar de sombras
  ad hoc por componente.

### 2.4 Movimiento

Se respeta `prefers-reduced-motion` en todo. Curva única `cubic-bezier(.22,1,.36,1)`,
duraciones 180/250/420/650 ms. Nada de parallax que capture el scroll.

---

## 3. Elementos 3D

El encargo es explícito: si hay 3D, tiene que verse como el objeto real.

Se sustituye el 3D actual por geometría construida a partir de perfiles reales:

- **Tijeras de barbero** — cada hoja se extruye desde una curva Bézier con el filo
  afilado, punta en aguja y lomo grueso; los ojos son toros con sección aplanada; el
  tornillo pivote es un cilindro biselado con ranura. Dos mitades espejadas que abren y
  cierran suavemente sobre el pivote real.
- **Navaja de afeitar** — hoja extruida con contrafilo, mango de dos cachas y pivote.
- **Peine** — barra con púas generadas por instancias, paso variable.
- **Poste de barbería** — hélice real (`TubeGeometry` sobre curva helicoidal) en oxblood y
  hueso dentro de un cilindro de vidrio, con casquillos cromados torneados por `LatheGeometry`.

Calidad de render:
- `MeshPhysicalMaterial` metálico (`metalness` 1, `roughness` 0.12–0.28, `clearcoat`).
- Entorno de estudio **procedural** con `Lightformer` dentro de `<Environment>`: da
  reflexiones reales sin descargar ningún HDR externo (importante por CSP y por peso).
- `ACESFilmicToneMapping`, sombras de contacto, DPR limitado a 1.6, `frameloop` pausado
  cuando el canvas sale del viewport.
- Degradación: sin WebGL o con `prefers-reduced-motion`, se muestra el fallback CSS ya
  existente. Ninguna escena captura el gesto del usuario.

---

## 4. Tarjetas digitales de pago

Dos defectos a corregir:

1. **Logos**: hoy Stripe y Mercado Pago son texto en Arial dentro de un `<svg>`. Se
   sustituyen por marcas vectoriales fieles (Stripe, Mercado Pago con el apretón de manos,
   Mercado Libre, Visa, Mastercard, American Express), con `role="img"` y `aria-label`.
2. **Recorte al girar**: la cara de la tarjeta es `position:absolute; inset:0; overflow:hidden`
   sobre un contenedor con `aspect-ratio` fijo, y el contenido interior usa `rem`. En
   contenedores estrechos (rejilla de dos columnas, móvil) el contenido excede la caja y se
   corta. Solución: `container-type: inline-size` en la tarjeta y **todas** las medidas
   interiores en `cqw`, de modo que la tarjeta escala como una pieza sólida a cualquier
   ancho. Además `backface-visibility` + `transform-style` explícitos en ambas caras y
   `will-change:transform` sólo durante el giro.

---

## 5. Acceso al sistema

Hoy el login es una pantalla de demo que entra por rol sin validar nada. El objetivo es un
acceso real, robusto y eficiente, que siga permitiendo la demo.

- Cliente Supabase de navegador (`@supabase/ssr`) — hoy no existe, sólo los de servidor.
- **Google OAuth con PKCE**: `signInWithOAuth` → `/auth/callback` → `exchangeCodeForSession`
  → redirección por rol.
- Correo y contraseña con `signInWithPassword`, y **enlace mágico** como alternativa sin
  contraseña.
- `middleware.ts` refresca la sesión en cada request y protege `/dashboard/*` y `/cuenta/*`.
- Rol resuelto desde `user_metadata.rol` con caída a la tabla `usuarios`.
- Un único hook `useSesion()` unifica sesión real y sesión demo, de modo que **ninguna
  página existente necesita cambiar**.
- Si no hay credenciales de Supabase configuradas, la app entra en modo demo
  automáticamente y lo dice en pantalla, en lugar de fallar.

---

## 6. Panel de marketing (Google Analytics + Google Ads)

Ruta nueva `/dashboard/admin/marketing`, con tres pestañas sobre un mismo contrato de datos:

- **Audiencia (GA4)**: usuarios activos, sesiones, engagement, canal de adquisición,
  páginas más vistas, serie temporal de 28 días.
- **Campañas (Google Ads)**: impresiones, clics, CTR, CPC medio, coste, conversiones,
  CPA y ROAS; tabla por campaña con estado y presupuesto.
- **Atribución**: embudo desde sesión → reserva iniciada → cita confirmada → cita pagada,
  cruzando el gasto publicitario con los ingresos reales del almacén de citas.

Arquitectura:

```
/api/integrations/analytics   ─ GA4 Data API v1 runReport  (JWT RS256 de cuenta de servicio)
/api/integrations/google-ads  ─ googleAds:searchStream GAQL (refresh token OAuth)
      ↓ ambos normalizan a src/lib/integrations/tipos.ts
      ↓ sin credenciales → dataset de demostración marcado como tal
/dashboard/admin/marketing    ─ misma UI para datos vivos y datos de demostración
```

Variables nuevas en `.env.example`, todas opcionales.

---

## 7. Módulos que completan el sistema

Seleccionados por lo que un negocio de barbería necesita para operar de verdad:

| Módulo | Ruta | Qué resuelve |
|---|---|---|
| **Marketing** | `/dashboard/admin/marketing` | Analytics + Ads + atribución |
| **Clientes (CRM)** | `/dashboard/admin/clientes` | Ficha 360, gasto acumulado, frecuencia, riesgo de fuga, lealtad |
| **Catálogo** | `/dashboard/admin/servicios` | Servicios, precios, duración y comisión |
| **Inventario** | `/dashboard/admin/inventario` | Existencias, consumo, alertas de reposición, valor de almacén |
| **Caja y finanzas** | `/dashboard/admin/caja` | Corte de caja, desglose por método de pago, gastos, comisiones, utilidad |
| **Integraciones** | `/dashboard/admin/integraciones` | Estado de Google Analytics, Google Ads, Meta Ads, Stripe, Mercado Pago, Calendar |

Todos operan sobre el almacén demo extendido (persistencia real en `localStorage`), igual
que el resto del producto, para que se puedan usar y no sólo mirar.

---

## 8. Orden de ejecución

1. Sistema de diseño (tokens, tipografía, materia) — base de todo lo demás.
2. Elementos 3D.
3. Tarjetas de pago y marcas.
4. Acceso y sesión.
5. Adaptadores de integraciones y panel de marketing.
6. Módulos de negocio y navegación.
7. Build, revisión y publicación.

## 9. Criterios de aceptación

- `next build` sin errores ni advertencias nuevas.
- Ninguna ruta, prop pública o clave de `localStorage` existente cambia de contrato.
- Contraste AA en todo texto; foco visible en todo control.
- Ninguna tarjeta, tabla o KPI se recorta entre 320 px y 1920 px.
- Las escenas 3D se apagan con `prefers-reduced-motion` y sin WebGL.
- El panel de marketing funciona sin credenciales y se marca como demostración.

---

### Fuentes de la investigación

- [16 Best Barbershop Website Design Examples 2026 — Colorlib](https://colorlib.com/wp/barbershop-websites/)
- [20 Best Barber Shop Websites of 2026 — CyberOptik](https://www.cyberoptik.net/blog/best-barber-shop-websites/)
- [Sleek Barbershop Website Design Examples — Slider Revolution](https://www.sliderrevolution.com/design/barbershop-websites/)
- [24 Best Barbershop Website Design Examples — The Salon Business](https://thesalonbusiness.com/barbershop-website-designs/)
- [30 Coolest Barbershop Brand Identity Design Ideas — Kreafolk](https://kreafolk.com/blogs/inspirations/barbershop-brand-identity)
- [50+ Iconic Barber Logos and What Makes Them Great — DesignMantic](https://www.designmantic.com/blog/barber-logo-inspirations/)
- [Google Analytics Data API v1 — quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart)
- [Google Ads API — reporting example](https://developers.google.com/google-ads/api/docs/reporting/example)
- [Google Ads API — REST examples](https://developers.google.com/google-ads/api/rest/examples)
