import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { MapRuntime } from "./map-runtime";

// Vendored OFL variable fonts (see app/fonts/LICENSE.txt): no font request
// leaves the origin at build time or at runtime.
const archivo = localFont({
  src: "./fonts/archivo-variable.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-variable.woff2", style: "normal", weight: "200 800" },
    { path: "./fonts/newsreader-italic-variable.woff2", style: "italic", weight: "200 800" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kestrel — commercial property investment intelligence",
  description:
    "Investigate commercial buildings, compare reuse scenarios and review an evidence-bound recommendation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <MapRuntime />
        {children}
      </body>
    </html>
  );
}
