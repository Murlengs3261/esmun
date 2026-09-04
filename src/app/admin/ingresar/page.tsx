"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function AdminIngresar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err || !data.user) {
      setCargando(false);
      setError("Correo o contraseña incorrectos. Revisa e intenta otra vez.");
      return;
    }

    const { data: perfil } = await supabase
      .from("profiles").select("role").eq("id", data.user.id).single();

    setCargando(false);

    if (perfil?.role !== "admin") {
      await supabase.auth.signOut();
      setError("Esa cuenta no es de administrador. Entra por la app de despacho.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5">
      <div className="mt-[72px] self-start border-2 border-accent px-4 py-3">
        <span className="font-plate text-section text-accent">ESMUN</span>
      </div>

      <h1 className="font-plate mt-8 text-title">Consola</h1>
      <p className="mt-2 text-sub text-fg-secondary">
        Registro de participantes, gafetes y control de entregas.
      </p>

      <form onSubmit={entrar} className="mt-10 flex flex-col gap-5">
        <Field label="Correo" type="email" inputMode="email" autoComplete="username"
               autoCapitalize="none" required value={email}
               onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />
        <Field label="Contraseña" type="password" autoComplete="current-password" required
               value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" size="xl" fullWidth loading={cargando} className="mt-4">
          {cargando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="type-micro mt-auto pb-8 pt-8 text-center text-fg-tertiary">
        Colegio Eagles · ESMUN 2026
      </p>
    </main>
  );
}
