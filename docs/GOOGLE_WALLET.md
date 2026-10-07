# Tarjeta de lealtad en Google Wallet

El sistema ya genera el pase de cada cliente (logo de CortMart, foto del local,
sellos, recompensas y QR) y lo actualiza solo cuando gana un sello. Sólo faltan
las credenciales de Google.

**Costo: $0.** La API de Google Wallet, la consola de emisor y la cuenta de
servicio de Google Cloud son gratuitas. No hace falta activar facturación.

## 1. Cuenta de emisor (Google Pay & Wallet Console)

1. Entra a <https://pay.google.com/business/console> con la cuenta de Google
   del negocio.
2. Acepta los términos y crea el perfil de negocio (nombre: *Barbería CortMart*).
3. Menú **Google Wallet API** → copia el **Issuer ID** (un número largo).

## 2. Cuenta de servicio (Google Cloud)

1. En <https://console.cloud.google.com> crea un proyecto (p. ej. `cortmart-wallet`).
2. **APIs y servicios → Biblioteca** → habilita **Google Wallet API**.
3. **IAM y administración → Cuentas de servicio → Crear**. Nombre:
   `wallet-cortmart`. No necesita roles.
4. Entra a la cuenta creada → **Claves → Agregar clave → JSON**. Se descarga
   un archivo; de ahí salen `client_email` y `private_key`.

## 3. Dar permiso a la cuenta de servicio

En la Pay & Wallet Console → **Usuarios** → **Invitar usuario** → pega el
`client_email` de la cuenta de servicio con rol **Desarrollador**.

## 4. Variables en Vercel

Proyecto `barberia` → **Settings → Environment Variables** (Production):

| Variable | Valor |
| --- | --- |
| `GOOGLE_WALLET_ISSUER_ID` | Issuer ID del paso 1 |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | `client_email` del JSON |
| `GOOGLE_WALLET_PRIVATE_KEY` | `private_key` del JSON, completo, con `-----BEGIN PRIVATE KEY-----` |
| `NEXT_PUBLIC_APP_URL` | El dominio público, p. ej. `https://barberia-partum.vercel.app` |

Opcionales: `GOOGLE_WALLET_COLOR` (fondo del pase, por defecto `#1a0f08`),
`GOOGLE_WALLET_LOGO_URL` y `GOOGLE_WALLET_HERO_URL` si quieren otro logo o foto.

Después de guardarlas, haz **Redeploy** del último despliegue de producción.

> `NEXT_PUBLIC_APP_URL` debe ser exactamente el dominio desde donde se pulsa
> el botón: Google rechaza el pase si no coincide.

## 5. Probar (modo demo)

Mientras Google no apruebe la cuenta, sólo pueden guardar el pase las cuentas
de prueba. En la Pay & Wallet Console → **Google Wallet API → Usuarios de
prueba**, agrega los correos con los que vas a probar. Luego:

- Cliente: *Mi cuenta → Mi tarjeta → Agregar a Google Wallet*.
- Mostrador: *Panel → Tarjetas de lealtad →* botón de Wallet de cada cliente.

## 6. Publicar para todos los clientes

En la consola → **Google Wallet API → Solicitar acceso de publicación**.
Google revisa la cuenta (suele tardar unos días hábiles). Al aprobarla, cualquier
cliente con Android puede guardar su tarjeta. No hay que cambiar nada en el código.

## Notas

- Google Wallet funciona en Android. En iPhone el cliente sigue usando su
  tarjeta desde *Mi cuenta → Mi tarjeta* (QR en pantalla).
- El pase se actualiza solo: al poner un sello en el mostrador, el teléfono del
  cliente muestra el nuevo conteo en unos segundos.
