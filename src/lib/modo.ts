// Modo local: activo mientras el proyecto no tiene Supabase configurado. Los
// datos viven en el navegador y las verificaciones externas (OTP, captcha)
// se simulan para poder operar antes de conectar la base de datos.
export const MODO_LOCAL = !process.env.NEXT_PUBLIC_SUPABASE_URL;

// Google Wallet queda oculto en toda la interfaz hasta que el negocio tenga
// su cuenta de emisor aprobada. Para mostrarlo: NEXT_PUBLIC_GOOGLE_WALLET=1.
export const WALLET_VISIBLE = process.env.NEXT_PUBLIC_GOOGLE_WALLET === "1";
