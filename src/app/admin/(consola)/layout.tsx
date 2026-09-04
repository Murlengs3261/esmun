import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar, AdminTabBar } from "@/components/admin/AdminNav";

export default async function ConsolaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/ingresar");

  const [{ data: perfil }, { data: evento }] = await Promise.all([
    supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
    supabase.from("events").select("name, logo_url").eq("is_active", true).maybeSingle(),
  ]);

  // Segunda barrera. La primera y verdadera son las políticas RLS.
  if (perfil?.role !== "admin") redirect("/escanear");

  return (
    <div className="flex min-h-[100dvh]">
      <AdminSidebar
        nombre={perfil.display_name}
        evento={evento?.name ?? "ESMUN"}
        logo={evento?.logo_url ?? null}
      />
      <div className="min-w-0 flex-1 pb-[92px] lg:pb-0">{children}</div>
      <AdminTabBar />
    </div>
  );
}
