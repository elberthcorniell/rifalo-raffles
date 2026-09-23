import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { ClientProviders } from "./client-providers";
import "./globals.css";

import "react-international-phone/style.css";

import { PLATFORM, getPlatformUrl } from "@/lib/constants";
import { getOrgFromHeaders, getOrgBrand } from "@/lib/tenant";
import { PATHNAME_HEADER } from "@/lib/tenant-host";
import { getBrandCssVars } from "@/lib/colors";

export const metadata: Metadata = {
  title: {
    default: `${PLATFORM.name} — Gestión de rifas`,
    template: `%s | ${PLATFORM.name}`,
  },
  description: PLATFORM.tagline,
  authors: [{ name: PLATFORM.name }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || getPlatformUrl()),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

function isStorefrontPath(pathname: string) {
  return (
    !!pathname &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/platform") &&
    !pathname.startsWith("/superadmin")
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const org = await getOrgFromHeaders();
  const brand = org ? getOrgBrand(org) : null;
  const pathname = (await headers()).get(PATHNAME_HEADER) || "";
  const applyDark =
    !!brand && isStorefrontPath(pathname) && brand.theme === "dark";
  const brandStyle = brand
    ? getBrandCssVars(brand.primaryColor, brand.secondaryColor)
    : undefined;

  return (
    <html
      lang="es"
      className={applyDark ? "dark" : undefined}
      style={brandStyle}
      suppressHydrationWarning
    >
      <body>
        <Providers initialOrg={org} initialBrand={brand}>
          <ClientProviders />
          {children}
        </Providers>
      </body>
    </html>
  );
}
