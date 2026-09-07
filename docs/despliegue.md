# Despliegue en Vercel

La consola y el escáner corren en Vercel como una app Next.js normal. La base
sigue siendo el proyecto de Supabase que ya existe: desplegar no la toca.

## Variables de entorno (Vercel › Project › Settings › Environment Variables)

Son las mismas tres de `.env.local`. Se copian de Supabase › Project Settings › API.

| Variable | Dónde se usa | Entorno |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador y servidor | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: crear cuentas de personal y cambiar contraseñas | Production + Preview |

La clave de servicio se salta las políticas de seguridad de la base. Nunca va
con prefijo `NEXT_PUBLIC_` y nunca se pega en el navegador: solo en Vercel.

## Primera vez

1. Subir el repositorio a GitHub (privado).
2. En [vercel.com/new](https://vercel.com/new), importar ese repositorio.
   Vercel detecta Next.js solo; no hay que cambiar el comando de build.
3. Antes de darle a **Deploy**, pegar las tres variables de arriba.
4. Esperar el build. La URL queda como `https://<proyecto>.vercel.app`.

Con la CLI es lo mismo sin pasar por la web:

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel --prod
```

## Después

Cada `git push` a `main` vuelve a desplegar producción. Cada rama aparte
genera una URL de vista previa con la misma base de datos.

`/vista-previa` (la herramienta de revisión de diseño) devuelve 404 en
producción; solo existe en local.

## Supabase

No hace falta configurar URLs de redirección: el ingreso es con correo y
contraseña, sin enlaces mágicos ni OAuth. Si algún día se activa la
recuperación de contraseña por correo, habrá que añadir el dominio de
Vercel en Supabase › Authentication › URL Configuration.

## Si el dominio devuelve «Internal Server Error»

Comprobar primero qué build está en línea: `https://<dominio>/version.txt`
muestra la fecha y el commit del despliegue que sirve ese dominio (el
archivo se genera en `public/version.txt` con cada cambio). Si ahí sale
un 500, ese dominio está sirviendo un build anterior al 7 de septiembre
de 2026 y no corresponde al proyecto conectado a GitHub.

Cuando el build es el actual, cualquier fallo del proxy sale escrito en
texto plano en la propia página (qué variable falta o qué error dio
Supabase), en vez del 500 mudo.

Las URLs `esmun-<equipo>.vercel.app` y `esmun-git-main-<equipo>.vercel.app`
piden iniciar sesión en Vercel por la «Vercel Authentication» de
Deployment Protection. Para que las abra cualquiera hay que apagarla en
Project → Settings → Deployment Protection, o usar el dominio de
producción (`esmun.vercel.app` o uno propio), que nunca está protegido.
