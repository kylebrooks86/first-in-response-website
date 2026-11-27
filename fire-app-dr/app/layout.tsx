import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FIRE App",
  description: "The private business app for First In Response Exteriors.",
  applicationName: "FIRE App",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FIRE App",
  },
  icons: {
    icon: "/fire-app-home-512-v2.png",
    shortcut: "/fire-app-home-512-v2.png",
    apple: "/fire-app-home-v2.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1b2f",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/fire-app-home-v2.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/fire-app-home-512-v2.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
