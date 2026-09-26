# Rifalo (multi-tenant)

Plataforma de gestión de rifas (Next.js 15) con **organizaciones** en subdominios, backend en **Supabase** y panel de administración por tenant. Empieza gratis (250 boletos/mes, sin tarjeta).

## Stack

- Next.js 15 (App Router) + React 18 + TypeScript + Tailwind / shadcn
- Supabase (Postgres, Auth, Storage)
- SendGrid (emails)

## Arquitectura multi-tenant

| Host | Qué muestra |
|------|-------------|
| `ROOT_DOMAIN` (apex) | Landing del producto + signup / login |
| `{slug}.ROOT_DOMAIN` | Tienda pública + `/admin` de esa organización |

La org **cura** se crea en la migración (datos existentes de Cura tu Suerte se migran ahí).

## Setup local

### 1. Dependencias

```bash
npm install
```

### 2. Supabase (CLI + Docker Desktop)

```bash
# Requiere Docker Desktop corriendo
supabase start

# Copia las keys que imprime el comando:
supabase status -o env
```

Crea `.env.local` (ver `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Las migraciones y el seed se aplican con `supabase start` / `supabase db reset`.

### 3. Crear admin de una org existente (cura)

1. Abre Studio: http://127.0.0.1:54323
2. Authentication → Users → Add user (email + password)
3. En SQL Editor, vincúlalo a la org:

```sql
INSERT INTO public.org_members (org_id, user_id, role)
SELECT o.id, u.id, 'owner'
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'cura'
  AND u.email = 'tu@email.com'
ON CONFLICT DO NOTHING;
```

(Ya no se usa `app_metadata.role = 'admin'`.)

### 4. App

```bash
npm run dev
```

- Plataforma (apex): http://localhost:3000
- Signup: http://localhost:3000/signup
- Tenant Cura: http://cura.localhost:3000
- Admin Cura: http://cura.localhost:3000/admin/login

> **Nota:** `app/` está en la raíz del proyecto, así que el middleware tiene que estar en [`middleware.ts`](middleware.ts), al mismo nivel que `app/`. Next.js no lo incluye si vive en `src/`.

Chrome resuelve `*.localhost`. Si las cookies no se comparten entre apex y subdominio en local, inicia sesión directamente en `/admin/login` del tenant.

## Producción (Vercel)

1. Dominio apex + wildcard `*.tudominio.com` (nameservers de Vercel, o delega `_acme-challenge` si el DNS es externo)
2. `NEXT_PUBLIC_ROOT_DOMAIN=tudominio.com`
3. Token de Vercel con permiso para editar dominios del proyecto: `VERCEL_TOKEN`. En Vercel, `VERCEL_PROJECT_ID` y `VERCEL_ORG_ID` ya vienen definidos; en local hay que ponerlos a mano (`VERCEL_TEAM_ID` si el equipo no es `VERCEL_ORG_ID`)
4. En Supabase Auth → Redirect URLs: `https://*.tudominio.com/**` y `https://tudominio.com/**`
5. `supabase db push` / link al proyecto hosted

El plan Ilimitado guarda el dominio propio y lo agrega al proyecto con la API de Vercel. El admin ve los registros DNS (y el TXT de verificación, si hace falta). Vercel emite el certificado cuando el dominio está verificado y el DNS apunta al proyecto. Al quitar el dominio, se desasocia del proyecto. Un apex también registra `www` con redirección.

## Self-serve

En el apex, `/signup` crea usuario Auth + `organizations` + `org_members` (owner) y redirige a `https://{slug}.{ROOT}/admin`.

## Facturación (Rifalo)

Planes mensuales por organización (conteo de boletos en compras `pending`/`confirmed` del mes, zona `America/Santo_Domingo`):

| Plan | Precio | Límite |
|------|--------|--------|
| Gratis | $0 | 250 boletos/mes |
| Plus | $20 | 50,000 boletos/mes |
| Ilimitado | $50 | Sin límite + dominio propio + varios admins + analítica avanzada |

Configura en `.env.local` (crea los Prices mensuales en el Dashboard de Stripe):

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_UNLIMITED=price_...
```

Webhook: `POST /api/billing/webhook` (eventos `checkout.session.completed`, `customer.subscription.*`).

Aplica la migración: `supabase db reset` (local) o `supabase db push`.

## Admin (por organización)

- **Dashboard** — pendientes, rifas activas, boletos
- **Rifas** — crear/editar, rangos de números, estados
- **Compras** — ver comprobante, confirmar / rechazar
- **Cuentas** — CRUD de cuentas bancarias
- **Ajustes** — nombre, logo, eslogan, emails (el slug no cambia)

## Flujo de compra

1. Cliente elige cantidad → transfiere → sube comprobante
2. El sistema asigna números al azar (`reserved`)
3. Admin confirma → `sold` + emails SendGrid
4. Admin rechaza → números vuelven a `available`
