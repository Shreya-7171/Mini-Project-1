import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import {
  Noto_Sans_Devanagari,
  Plus_Jakarta_Sans,
} from "next/font/google"
import "./globals.css"
import "./mobile-flow.css"
import { I18nProvider } from "@/components/i18n-provider"
import { AuthProvider } from "@/components/auth-provider"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
})

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
})

export const metadata: Metadata = {
  title: "CivicVision AI | SMKMC",
  description: "AI-powered civic issue reporting for Sangli-Miraj-Kupwad Municipal Corporation.",
  icons: {
    icon: "/pwa-icon.svg",
  },
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#0F2A4A",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${notoSansDevanagari.variable} antialiased`}
      >
        <AuthProvider>
          <I18nProvider>{children}</I18nProvider>
        </AuthProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
