export const metadata = {
  title: "Breaks App",
  description: "Check who’s free and manage college breaks easily."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Progressive Web App setup */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#06b6d4" />

        {/* ✅ Icons for Android + iPhone */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />

        {/* ✅ Optional PWA meta */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Breaks App" />
      </head>
      <body className="bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
