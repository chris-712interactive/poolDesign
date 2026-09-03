import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PoolShape — CAD, 3D, and takeoff for production pool companies",
  description:
    "Plan, 3D walkthrough, live client finishes, and model-based takeoff for residential pool companies. 14-day company trial. No credit card.",
  icons: {
    icon: [{ url: "/brand/mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/mark.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,650&family=Outfit:wght@400;500;600;700&family=Source+Sans+3:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
