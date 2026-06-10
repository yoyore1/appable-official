import type { Metadata, Viewport } from "next";
import { appUrl } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Appable — Build your first app free",
  description:
    "You have an idea. We'll turn it into a real app on the App Store. No coding. Seriously.",
  metadataBase: new URL(appUrl),
  openGraph: {
    title: "Appable — Build your first app free",
    description: "Turn your idea into a real iOS app. No coding.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FDFAF4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="grain min-h-screen">
        {children}
      </body>
    </html>
  );
}
