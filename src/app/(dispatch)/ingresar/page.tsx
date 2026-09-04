"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function Ingresar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!navigator.onLine) {
      setError("Sin conexión: no se puede iniciar sesión. Busca señal y vuelve a intentar.");
      return;
    }

    setCargando(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);

    if (err) {
      setError("Correo o contraseña incorrectos. Revisa e intenta otra vez.");
      return;
    }
    router.replace("/puesto");
    router.refresh();
  }

  return (
    <main className="flex min-h-[100dvh] flex-col px-5">
      <div className="pt-safe" />

      {/* La placa: el objeto del que sale todo el lenguaje visual */}
      <div className="mt-[72px] self-start border-2 border-accent px-4 py-3">
        <span className="font-plate text-section text-accent">ESMUN</span>
      </div>

      <h1 className="font-plate mt-8 text-title">Despacho de comida</h1>
      <p className="mt-2 text-sub text-fg-secondary">
        Ingresa con la cuenta que te dio la organización.
      </p>

      <form onSubmit={entrar} className="mt-10 flex flex-col gap-5">
        <Field
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
        />

        <Field
          label="Contraseña"
          type={ver ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              className="h-12 px-3 text-label font-semibold text-accent"
            >
              {ver ? "Ocultar" : "Ver"}
            </button>
          }
        />

        <p className="text-label text-fg-tertiary">
          ¿Olvidaste la contraseña? Habla con el organizador: no hay recuperación
          automática durante el evento.
        </p>

        {/* El botón se queda pegado sobre el teclado, nunca cubierto */}
        <div className="sticky bottom-4 mt-6">
          <Button type="submit" size="xl" fullWidth loading={cargando}>
            {cargando ? "Entrando…" : "Entrar"}
          </Button>
        </div>
      </form>

      <p className="type-micro mt-auto pt-8 text-center text-fg-tertiary">
        Colegio Eagles · ESMUN 2026
      </p>
      <div className="pb-safe" />
    </main>
  );
}
