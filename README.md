# To-Do Priority

PWA de gestión de tareas con **matriz de prioridad de Eisenhower**, **control de hábitos** con rachas 🔥, temporizador **Pomodoro** y autenticación con Supabase. Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui. UI diseñada con Google Stitch, con modo claro/oscuro e idioma ES/EN.

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto de Supabase

1. Entra en [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (nombre `to-do-priority`, región más cercana; guarda la contraseña de la BD).
2. En **Project Settings → API** copia la URL y la publishable key a `.env.local` (usa `.env.example` como plantilla):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```
3. En **SQL Editor** ejecuta en orden:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_storage.sql`
   - `supabase/migrations/0004_list_customization.sql`
4. **Authentication → URL Configuration**: Site URL `http://localhost:3000`; añade `http://localhost:3000/auth/callback` a Redirect URLs.
5. **Google OAuth**: en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un OAuth 2.0 Client ID (tipo Web) con redirect URI `https://<ref>.supabase.co/auth/v1/callback`; pega client ID y secret en Supabase → **Authentication → Providers → Google** y actívalo.
6. (Opcional, agiliza el desarrollo) **Authentication → Providers → Email**: desactiva "Confirm email".

### 3. Arrancar

```bash
npm run dev
```

## Despliegue en Vercel

1. **Importa el repo** en [vercel.com/new](https://vercel.com/new) (framework Next.js, sin config extra).
2. **Variables de entorno** (Project Settings → Environment Variables, entornos Production y Preview):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```
   ⚠️ Nunca subas `SUPABASE_SERVICE_ROLE_KEY` a Vercel: solo se usa en local para los e2e.
3. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://<tu-app>.vercel.app` (tu dominio de producción).
   - Redirect URLs: añade (sin quitar las de localhost, para seguir desarrollando):
     ```
     https://<tu-app>.vercel.app/auth/callback
     https://*-<tu-usuario-o-team>.vercel.app/auth/callback   ← opcional, para preview deployments
     ```
4. **Google Cloud Console**: no hay que tocar nada — el redirect URI autorizado sigue siendo `https://<ref>.supabase.co/auth/v1/callback`, porque Google siempre redirige a Supabase y Supabase luego a tu app (según las Redirect URLs del paso 3).

Notas:
- El código construye las URLs de callback con el origin de cada request (`/api/auth/google`, registro), así que la misma build funciona en localhost, previews y producción sin variables adicionales.
- La PWA (service worker, instalación) requiere HTTPS; en Vercel ya lo tienes. Verifica `https://<tu-app>.vercel.app/manifest.webmanifest` tras el deploy.
- Si usas dominio propio, repite el paso 3 con ese dominio.

## Arquitectura

- **El front nunca llama a Supabase**: toda operación pasa por endpoints en `app/api/**`, que usan el cliente de servidor. **Todos los endpoints exigen un token de sesión válido** (`requireUser()` → 401 si no); solo login/register/google son públicos. La sesión viaja en cookies httpOnly (`@supabase/ssr`) y RLS actúa como segunda capa.
- `proxy.ts` (middleware de Next 16) refresca la sesión y redirige a `/login` a los no autenticados.
- Recurrencia y castigos de hábitos son lógica pura testeada (`lib/recurrence.ts`, `lib/habits.ts`); los castigos se derivan en lectura, nunca se almacenan.
- Tema e idioma persisten en `localStorage` (cookie espejo para SSR sin parpadeo).

## Tests

```bash
npm test              # Vitest: unitarios + integración (RTL)
npm run test:e2e      # Playwright (requiere el paso siguiente)
```

Para e2e crea `.env.test.local` con la **service role key** (solo local, nunca `NEXT_PUBLIC_`):

```
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

El global-setup crea un usuario de prueba confirmado (`e2e@test.local`) vía admin API y limpia sus datos en cada corrida. Instala los navegadores la primera vez: `npx playwright install chromium`.

## Página About

`app/(app)/about/page.tsx` contiene placeholders `{{CREATOR_NAME}}`, `{{CREATOR_EMAIL}}` y `{{REPO_URL}}` — sustitúyelos con tus datos reales.
