// Modo local: activo mientras el proyecto no tiene Supabase configurado. Los
// datos viven en el navegador y las verificaciones externas (OTP, captcha)
// se simulan para poder operar antes de conectar la base de datos.
export const MODO_LOCAL = !process.env.NEXT_PUBLIC_SUPABASE_URL;
