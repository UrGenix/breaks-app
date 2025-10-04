import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Breaks App – MVP",
  description: "Find free times across timetables",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-[100svh] bg-slate-950 text-slate-100 antialiased overflow-x-hidden">
        {/* full-bleed fixed background */}
        <div className="bg-layer" />

        {/* safe padded content */}
        <div className="relative z-10 page-safe mx-auto max-w-5xl w-full">
          {children}
        </div>
      </body>
    </html>
  );
}

