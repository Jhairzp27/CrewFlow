import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrewFlow",
  description: "Gestión de horarios U2 / U3",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  // Se decide el tema en el servidor (vía cookie) en vez de con un script
  // que mute el DOM antes de hidratar — así el HTML ya sale correcto desde
  // el primer render y no hay mismatch de hidratación que "silenciar".
  const isDark = cookieStore.get("crewflow-theme")?.value === "dark";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${
        isDark ? " dark" : ""
      }`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
