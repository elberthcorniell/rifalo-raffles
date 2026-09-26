import type { Metadata } from "next";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import RaffleGrid from "@/components/RaffleGrid";
import TrustBenefits from "@/components/TrustBenefits";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import StickyRaffleBanner from "@/components/StickyRaffleBanner";
import { fetchFirstRaffle } from "@/lib/raffles";
import { getOrgFromHeaders, getOrgBrand } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgFromHeaders()
  if (!org) {
    return { title: 'Organización no encontrada' }
  }
  const brand = getOrgBrand(org)
  const firstRaffle = await fetchFirstRaffle(org.id);

  if (!firstRaffle) {
    return {
      title: `${brand.name} - Rifas`,
      description: brand.tagline || `Participa en rifas en ${brand.name}.`,
      openGraph: {
        title: brand.name,
        description: brand.tagline || '',
        type: "website",
        images: [brand.logo],
      },
    };
  }

  const title = `${firstRaffle.title} - ${brand.name}`;
  const description = firstRaffle.description || `Participa por solo RD$${firstRaffle.ticketPrice.toLocaleString()} y gana ${firstRaffle.title}`;
  const image = firstRaffle.image;

  return {
    title,
    description,
    openGraph: {
      title: `${firstRaffle.title} | ${brand.name}`,
      description: `${description} - Boletos desde RD$${firstRaffle.ticketPrice.toLocaleString()}`,
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: firstRaffle.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: firstRaffle.title,
      description: `${description} - Boletos desde RD$${firstRaffle.ticketPrice.toLocaleString()}`,
      images: [image],
    },
  };
}

export default async function Home() {
  const org = await getOrgFromHeaders()
  const brand = org ? getOrgBrand(org) : null
  const showHeroCopy = brand?.showHeroCopy !== false
  const showHowItWorks = brand?.showHowItWorks !== false
  const showRaffles = brand?.showRaffles !== false
  const showTrustBenefits = brand?.showTrustBenefits !== false
  const showTestimonials = brand?.showTestimonials !== false

  return (
    <div className="min-h-screen bg-background font-poppins pb-20 md:pb-0">
      <Header />
      <main>
        <Hero showCopy={showHeroCopy} showHowItWorks={showHowItWorks} showRaffles={showRaffles} />
        {showHowItWorks && <HowItWorks />}
        {showRaffles && <RaffleGrid />}
        {showTrustBenefits && <TrustBenefits />}
        {showTestimonials && <Testimonials />}
      </main>
      <Footer showHowItWorks={showHowItWorks} showRaffles={showRaffles} showTestimonials={showTestimonials} />
      <StickyRaffleBanner />
    </div>
  );
}
