import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { ClientProviders } from "./client-providers";
import "./globals.css";

import { PLATFORM, getPlatformUrl } from "@/lib/constants";
import { getOrgFromHeaders, getOrgBrand } from "@/lib/tenant";
import { PATHNAME_HEADER } from "@/lib/tenant-host";
import { getBrandCssVars, getThemeSurfaceCssVars } from "@/lib/colors";
import { fontFamilyValue, googleFontsHref } from "@/lib/fonts";
import { hostnameFromHeaderValue } from "@/lib/meta-host";
import { resolveMetaPixelId } from "@/lib/meta-server";

export async function generateMetadata(): Promise<Metadata> {
  const metadata: Metadata = {
    title: {
      default: `${PLATFORM.name} — Gestión de rifas`,
      template: `%s | ${PLATFORM.name}`,
    },
    description: PLATFORM.tagline,
    authors: [{ name: PLATFORM.name }],
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || getPlatformUrl()),
  };

  const org = await getOrgFromHeaders();
  const pathname = (await headers()).get(PATHNAME_HEADER) || "";
  if (org?.custom_domain && isStorefrontPath(pathname)) {
    const path = pathname === "/" ? "" : pathname;
    metadata.alternates = {
      canonical: `https://${org.custom_domain}${path}`,
    };
  }

  return metadata;
}

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
  const headerList = await headers();
  const org = await getOrgFromHeaders();
  const brand = org ? getOrgBrand(org) : null;
  const pathname = headerList.get(PATHNAME_HEADER) || "";
  const metaPixelId = resolveMetaPixelId(
    hostnameFromHeaderValue(headerList.get("x-forwarded-host") || headerList.get("host")),
  );
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
          <ClientProviders metaPixelId={metaPixelId} />
          {children}
        </Providers>
        {metaPixelId ? (
          <noscript>
            {/* Meta requires this tracking pixel to be a plain image request. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height={1}
              width={1}
              alt=""
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        ) : null}
      </body>
    </html>
  );
}
