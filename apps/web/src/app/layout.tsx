import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/theme-provider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "AI SalesOS",
  description: "Turn WhatsApp conversations into organized sales.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#5d87ff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className={`${dmSans.className} min-h-full flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ServiceWorkerRegister />
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
