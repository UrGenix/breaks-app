import "./globals.css";
export const metadata = {
  title: "Breaks App",
  description: "See who’s free right now",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA meta */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="Breaks App" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Breaks App" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Light/Dark theme colors to tint the status bar */}
        <meta name="theme-color" content="#06b6d4" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />

        {/* Icons for iOS homescreen */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Optional: maskable icon for Android adaptive icons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
