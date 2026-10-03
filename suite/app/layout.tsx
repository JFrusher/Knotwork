import type { Metadata } from "next";
import { Lato, Marcellus } from "next/font/google";
import { PageCounts } from "@/components/shell/PageCounts";
import { ReportUnhandled } from "@/components/shell/ReportUnhandled";
import { Speed } from "@/components/shell/Speed";
import { onVercel, siteUrl } from "@/lib/env";
import "./globals.css";
// Before any tool's own stylesheet: each of those maps its vocabulary onto the
// values decided here, so these have to exist by the time they are read.
import "@/lib/design/tokens.css";

// Self-hosted at build time — no runtime request leaves the browser, which is
// the whole premise of these tools.
const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
});
const lato = Lato({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-lato",
});

const description =
  "Seating, stationery, timeline and crew for one wedding. Free, open source, and entirely on your own device.";

export const metadata: Metadata = {
  // Absolute URLs for canonical links and OpenGraph tags are built from this.
  // Without it Next emits relative ones, which crawlers and link previews
  // resolve against whatever host they happened to fetch from.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Knotwork",
    // Pages set their own; this keeps the suffix in one place for the rest.
    template: "%s · Knotwork",
  },
  description,
  applicationName: "Knotwork",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Knotwork",
    title: "Knotwork",
    description,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: "Knotwork", description },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${marcellus.variable} ${lato.variable}`}>
      {/* Nothing but the page here. The header and the local document belong to
          the (app) group; /seat deliberately gets neither. */}
      <body>
        <ReportUnhandled />
        {children}
        {/* Cookieless page counts on the hosted instance. Vercel serves the
            endpoint, so a copy hosted anywhere else sends nothing. */}
        {onVercel() ? <PageCounts /> : null}
        {onVercel() ? <Speed /> : null}
      </body>
    </html>
  );
}