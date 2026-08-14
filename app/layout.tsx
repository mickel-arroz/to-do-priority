import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

// Self-hosted variable fonts: the files live in app/fonts, no runtime
// requests to Google Fonts
const hankenGrotesk = localFont({
  src: [
    {
      path: "./fonts/HankenGrotesk-var-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/HankenGrotesk-var-italic-latin.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-hanken-grotesk",
});

const bricolage = localFont({
  src: [
    {
      path: "./fonts/BricolageGrotesque-var-latin.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-bricolage",
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
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#14171d" },
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
      className={`${hankenGrotesk.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LocaleProvider initialLocale={locale}>
            {children}
            <Toaster position="top-center" richColors />
            <ServiceWorkerRegistrar />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
