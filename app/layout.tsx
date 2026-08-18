import type { Metadata, Viewport } from "next";
import { Roboto_Condensed } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

// Self-hosted at build time by next/font: fonts are served as static assets
// from our own domain, so the browser makes no runtime requests to Google.
const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "To-Do Priority",
  description:
    "Tareas con matriz de prioridad, hábitos y pomodoro | Tasks with priority matrix, habits and pomodoro",
  applicationName: "To-Do Priority",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "To-Do Priority",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f14" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${robotoCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Guarda la zona horaria real del dispositivo en una cookie antes de
            hidratar (patrón anti-parpadeo, sin useEffect). El servidor la lee
            en getUserToday() para calcular "hoy" en la hora local del usuario.
            Solo reescribe si cambió (p. ej. al viajar), así que es casi gratis. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;" +
              "if(tz&&document.cookie.split('; ').indexOf('tz='+tz)===-1){" +
              "document.cookie='tz='+tz+';path=/;max-age=31536000;samesite=lax'}}catch(e){}})();",
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <LocaleProvider initialLocale={locale}>
            <GridPattern
              className="fixed inset-0 -z-10 fill-foreground/[0.09] stroke-foreground/[0.09] [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
              aria-hidden="true"
            />
            <PomodoroProvider>{children}</PomodoroProvider>
            <Toaster position="top-center" richColors />
            <ServiceWorkerRegistrar />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
