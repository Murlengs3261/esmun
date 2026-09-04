import { exigirAdmin } from "@/lib/supabase/admin";
import { Pagina } from "@/components/admin/Pagina";
import { NuevoUsuario } from "@/components/admin/NuevoUsuario";
import { FilaUsuario, type Usuario } from "@/components/admin/FilaUsuario";

export const dynamic = "force-dynamic";

export default async function Personal() {
  const { admin, adminId } = await exigirAdmin();

  const [{ data: perfiles }, { data: cuentas }, { data: canjes }] = await Promise.all([
    admin.from("profiles").select("id, display_name, role, is_active").order("display_name"),
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("redemptions").select("dispatched_by"),
  ]);

  const correos = new Map((cuentas?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const conteo = new Map<string, number>();
  for (const r of canjes ?? []) {
    conteo.set(r.dispatched_by, (conteo.get(r.dispatched_by) ?? 0) + 1);
  }

  const todos: Usuario[] = (perfiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    is_active: p.is_active,
    email: correos.get(p.id) ?? null,
    entregas: conteo.get(p.id) ?? 0,
  }));

  const admins = todos.filter((u) => u.role === "admin");
  const escaneadores = todos.filter((u) => u.role === "dispatcher");
  const activos = escaneadores.filter((u) => u.is_active).length;

  return (
    <Pagina
      eyebrow={`${admins.length} ${admins.length === 1 ? "administrador" : "administradores"} · ${activos} ${activos === 1 ? "escaneador activo" : "escaneadores activos"}`}
      titulo="Personal"
      descripcion="Quién trabaja el evento desde adentro. Una cuenta por persona, siempre: el acta dice «entregado por Ana Solís», y si tres personas comparten un login esa columna deja de servir para nada."
      acciones={<NuevoUsuario />}
    >
      <Grupo
        titulo="Administradores"
        nota="Ven todo, abren y cierran sesiones, registran participantes, anulan entregas y gestionan este mismo apartado."
        gente={admins}
        adminId={adminId}
        vacio="No hay ningún administrador. Eso no debería poder pasar."
      />

      <Grupo
        titulo="Escaneadores"
        nota="Solo escanean. No pueden ver la lista de participantes, ni abrir sesiones, ni anular nada. Si ese teléfono se pierde, no se va con él la base de datos."
        gente={escaneadores}
        adminId={adminId}
        vacio="Todavía no hay escaneadores. Crea una cuenta por cada persona que vaya a estar en un puesto."
      />

      <p className="max-w-[62ch] text-label text-fg-tertiary">
        Dar de baja no borra la cuenta: deja de poder entrar, pero sus entregas
        siguen en el historial con su nombre. Borrarla de verdad rompería el
        acta, así que el sistema no lo permite.
      </p>
    </Pagina>
  );
}

function Grupo({
  titulo, nota, gente, adminId, vacio,
}: {
  titulo: string;
  nota: string;
  gente: Usuario[];
  adminId: string;
  vacio: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-3">
        <h2 className="font-plate text-section">
          {titulo}{" "}
          <span className="text-fg-tertiary">{gente.length}</span>
        </h2>
        <p className="mt-1 max-w-[62ch] text-sub text-fg-tertiary">{nota}</p>
      </div>

      {gente.length === 0 ? (
        <p className="border border-dashed border-line-control p-5 text-body text-fg-tertiary">
          {vacio}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {gente.map((u) => (
            <FilaUsuario key={u.id} u={u} esYo={u.id === adminId} />
          ))}
        </ul>
      )}
    </section>
  );
}
