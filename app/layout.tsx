import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { ClientProviders } from "./client-providers";
import "./globals.css";

import "react-international-phone/style.css";

import { PLATFORM, getPlatformUrl } from "@/lib/constants";
import { getOrgFromHeaders, getOrgBrand } from "@/lib/tenant";
import { PATHNAME_HEADER } from "@/lib/tenant-host";
import { getBrandCssVars, getThemeSurfaceCssVars } from "@/lib/colors";
import { fontFamilyValue, googleFontsHref } from "@/lib/fonts";

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
  const applyStorefront = !!brand && isStorefrontPath(pathname);
  const applyDark = applyStorefront && brand.theme === "dark";
  const brandStyle: CSSProperties | undefined = brand
    ? ({
        ...getBrandCssVars(brand.primaryColor, brand.secondaryColor),
        ...(applyStorefront
          ? {
              "--font-heading": fontFamilyValue(brand.headingFont),
              "--font-body": fontFamilyValue(brand.bodyFont),
              ...(brand.theme === "custom" ? getThemeSurfaceCssVars(brand.themeColors) : {}),
            }
          : {}),
      } as CSSProperties)
    : undefined;

  return (
    <html
      lang="es"
      className={[applyDark ? "dark" : "", applyStorefront ? "storefront" : ""].filter(Boolean).join(" ") || undefined}
      style={brandStyle}
      suppressHydrationWarning
    >
      {applyStorefront && (
        <link
          id="site-fonts"
          rel="stylesheet"
          href={googleFontsHref([brand.headingFont, brand.bodyFont])}
        />
      )}
      <body>
        <Providers initialOrg={org} initialBrand={brand}>
          <ClientProviders />
          {children}
        </Providers>
      </body>
    </html>
  );
}
