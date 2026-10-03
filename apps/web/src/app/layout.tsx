import Script from "next/script";
import type { Metadata } from "next";
import { Providers } from "@/lib/store";
import "./globals.css";
export const metadata: Metadata = {
  title: "Velora — Smarter Booking. Smoother Flow.",
  description: "Premium salon appointments and live queue management.",
  icons: { icon: "/brand/app-icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {process.env.NEXT_PUBLIC_FIGMA_CAPTURE === "1" && (
          <Script
            src="https://mcp.figma.com/mcp/html-to-design/capture.js"
            strategy="afterInteractive"
          />
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
