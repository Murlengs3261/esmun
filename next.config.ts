import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Sin esto, Turbopack sube por el árbol y toma un package-lock.json
  // suelto del directorio personal como raíz del proyecto.
  turbopack: { root: __dirname },
  images: supabase
    ? { remotePatterns: [{ protocol: "https", hostname: new URL(supabase).hostname }] }
    : undefined,
};

export default nextConfig;
