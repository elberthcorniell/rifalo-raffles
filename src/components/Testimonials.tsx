import { getOrgFromHeaders } from "@/lib/tenant";
import { listOrgTestimonials } from "@/lib/testimonials";
import { TestimonialsList } from "@/components/TestimonialsList";
import type { Testimonial } from "@/types/testimonial";

export default async function Testimonials({
  items,
}: {
  items?: Testimonial[];
}) {
  let testimonials = items;
  if (!testimonials) {
    const org = await getOrgFromHeaders();
    if (!org) return null;
    testimonials = await listOrgTestimonials(org.id, { activeOnly: true });
  }

  return <TestimonialsList testimonials={testimonials} />;
}
