import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BLOG_EMAIL_EXCLUDED_ORG_SLUGS,
  classifyBlogAudiences,
  deliveryBlocksResend,
  type AudienceUser,
} from "../src/lib/blog-audience.ts";
import {
  BLOG_DEFAULT_COVER,
  blogCoverPublicPath,
  blogStructuredData,
  isBlogPostVisible,
  latestPublishedBlogPosts,
  loadBlogPosts,
  marketingSitemapEntries,
  parseBlogSource,
  renderBlogBody,
  sitemapBlogPaths,
  visibleBlogPosts,
} from "../src/lib/blog.ts";
import { buildBlogEmail, withEmailUtms } from "../src/lib/blog-email.ts";
import { buildRobots, isMarketingHost } from "../src/lib/robots-policy.ts";
import { isBlogUnsubscribePath, isMarketingBlogPath } from "../src/lib/blog-paths.ts";
import { signBlogUnsubscribeToken, verifyBlogUnsubscribeToken } from "../src/lib/blog-unsubscribe.ts";

const SECRET = "test-secret";

describe("blog publish filter and sitemap", () => {
  const posts = loadBlogPosts();
  const post = posts.find((item) => item.slug === "como-vender-boletos-de-rifa");

  it("loads the first post as published, dated today, with the brief's copy", () => {
    assert.ok(post);
    assert.equal(post.published, true);
    assert.equal(post.date, "2026-11-21");
    assert.equal(post.seoTitle, "Cómo vender boletos de rifa: lo que hace un organizador top");
    assert.equal(post.coverImage, "/blog/como-vender-boletos-de-rifa/cover.png");
    assert.equal(post.faq.length, 4);
    assert.equal(post.emailSubjects.length, 3);
    assert.equal(post.emailSubjects[0], "Organizador: esto hace el que más boletos vende en Rifalo");
    assert.match(post.body, /Link de la rifa en la bio de Instagram/);
    assert.match(renderBlogBody(post.body), /<ul class="blog-checklist">/);
  });

  it("hides unpublished posts in production and keeps them in preview", () => {
    const draft = { ...post!, published: false };
    assert.equal(isBlogPostVisible(post!, "production"), true);
    assert.equal(isBlogPostVisible(draft, "production"), false);
    assert.equal(isBlogPostVisible(draft, "preview"), true);
    assert.equal(visibleBlogPosts([draft], "production").length, 0);
    assert.equal(visibleBlogPosts([draft], "preview").length, 1);
  });

  it("lists the marketing home and signup, and leaves drafts and tenant legal pages out", () => {
    assert.deepEqual(sitemapBlogPaths(posts), [
      "/",
      "/signup",
      "/blog",
      "/blog/como-vender-boletos-de-rifa",
    ]);
    assert.deepEqual(
      sitemapBlogPaths([
        { slug: "publicado", published: true, date: "2026-11-01", updated: "2026-11-20" },
        { slug: "borrador", published: false, date: "2026-11-02" },
      ]),
      ["/", "/signup", "/blog", "/blog/publicado"],
    );
    const published = marketingSitemapEntries([
      { slug: "publicado", published: true, date: "2026-11-01", updated: "2026-11-20" },
    ]).find((entry) => entry.path === "/blog/publicado");
    assert.equal(published?.lastModified, "2026-11-20");
    assert.equal(
      sitemapBlogPaths(posts).some((path) => path === "/terminos" || path === "/privacidad"),
      false,
    );
  });

  it("uses the cover file and falls back to the default OG image", () => {
    assert.ok(post);
    assert.equal(blogCoverPublicPath(post), "/blog/como-vender-boletos-de-rifa/cover.png");
    assert.equal(
      blogCoverPublicPath({ slug: "sin-portada", coverImage: "/blog/sin-portada/cover.png" }),
      BLOG_DEFAULT_COVER,
    );
  });

  it("builds Article and FAQ JSON-LD from the frontmatter", () => {
    assert.ok(post);
    const graph = blogStructuredData(post, "https://rifalo.do/blog/como-vender-boletos-de-rifa/opengraph-image");
    const article = graph.find((item) => item["@type"] === "Article");
    const faq = graph.find((item) => item["@type"] === "FAQPage");
    const crumbs = graph.find((item) => item["@type"] === "BreadcrumbList");
    assert.ok(article);
    assert.ok(faq);
    assert.equal(article.dateModified, `${post.date}T00:00:00-04:00`);
    const questions = faq.mainEntity as { name: string }[];
    assert.equal(questions[0].name, "¿A qué hora conviene promocionar una rifa?");
    const items = crumbs?.itemListElement as { name: string }[];
    assert.deepEqual(items.map((item) => item.name), ["Inicio", "Blog", post.h1]);
    assert.doesNotMatch(post.coverAlt, new RegExp(post.h1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(post.coverAlt, /57\.6%/);
    assert.match(post.coverAlt, /59\.8%/);
  });

  it("uses updated as dateModified when the frontmatter has it", () => {
    const parsed = parseBlogSource(
      ["---", "slug: nota", "seoTitle: T", "h1: H", "metaDescription: M", "date: 2026-11-01", "updated: 2026-11-21", "published: true", "---", "", "Hola"].join("\n"),
    );
    assert.equal(parsed.updated, "2026-11-21");
    const article = blogStructuredData(parsed, "https://rifalo.do/x").find((item) => item["@type"] === "Article");
    assert.equal(article?.dateModified, "2026-11-21T00:00:00-04:00");
    assert.equal(article?.datePublished, "2026-11-01T00:00:00-04:00");
  });
});

describe("blog email", () => {
  const post = loadBlogPosts()[0];

  it("uses the short email body, both calls to action, and UTMs", () => {
    const email = buildBlogEmail({
      post,
      subject: post.emailSubjects[0],
      coverUrl: "https://rifalo.do/blog/como-vender-boletos-de-rifa/opengraph-image",
      unsubscribeUrl: "https://rifalo.do/baja?token=abc",
    });
    assert.match(email.html, /Ver los 7 consejos/);
    assert.match(email.html, /Crear mi cuenta gratis/);
    assert.match(email.html, /Pone el link de la rifa en su bio de Instagram/);
    assert.match(email.html, /utm_source=email/);
    assert.match(email.html, /utm_medium=email/);
    assert.match(email.html, /utm_campaign=como-vender-boletos-de-rifa/);
    assert.match(email.html, /\/blog\/como-vender-boletos-de-rifa\?/);
    assert.match(email.html, /\/signup\?/);
    assert.doesNotMatch(email.html, /5\.4 días/);
    assert.match(email.html, /baja\?token=abc/);
    assert.doesNotMatch(email.html, /baja\?token=abc[^"]*utm_source/);

    const signup = new URL(withEmailUtms("https://rifalo.do/signup?plan=free", post.slug));
    assert.equal(signup.searchParams.get("plan"), "free");
    assert.equal(signup.searchParams.get("utm_source"), "email");
    assert.equal(signup.searchParams.get("utm_medium"), "email");
    assert.equal(signup.searchParams.get("utm_campaign"), post.slug);
  });
});

describe("unsubscribe token", () => {
  it("round-trips the address and rejects a tampered token", () => {
    const token = signBlogUnsubscribeToken("Hola@Rifalo.do", SECRET);
    assert.equal(verifyBlogUnsubscribeToken(token, SECRET), "hola@rifalo.do");
    assert.equal(verifyBlogUnsubscribeToken(token, "other-secret"), null);
    assert.equal(verifyBlogUnsubscribeToken(`${token}x`, SECRET), null);
    assert.equal(verifyBlogUnsubscribeToken("nope", SECRET), null);

    const [payload, signature] = token.split(".");
    const flipped = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}.${signature}`;
    assert.equal(verifyBlogUnsubscribeToken(flipped, SECRET), null);
  });
});

describe("blog audience", () => {
  const users: AudienceUser[] = [
    {
      id: "cura-only",
      email: "cura@rifalo.do",
      emailConfirmed: true,
      orgs: [{ slug: "cura", plan: "plus", stripeStatus: "active", hasActiveRaffle: true, ticketsSold: 0 }],
    },
    {
      id: "real-free",
      email: "libre@rifalo.do",
      emailConfirmed: true,
      orgs: [
        { slug: "test", plan: "unlimited", stripeStatus: "active", hasActiveRaffle: true, ticketsSold: 9 },
        { slug: "real", plan: "free", stripeStatus: null, hasActiveRaffle: true, ticketsSold: 0 },
      ],
    },
    {
      id: "unverified",
      email: "nuevo@rifalo.do",
      emailConfirmed: false,
      orgs: [{ slug: "real", plan: "plus", stripeStatus: "active", hasActiveRaffle: true, ticketsSold: 0 }],
    },
    {
      id: "paying",
      email: "plus@rifalo.do",
      emailConfirmed: true,
      orgs: [{ slug: "real", plan: "plus", stripeStatus: "active", hasActiveRaffle: false, ticketsSold: 4 }],
    },
    {
      id: "unsubscribed",
      email: "baja@rifalo.do",
      emailConfirmed: true,
      orgs: [{ slug: "real", plan: "free", stripeStatus: null, hasActiveRaffle: false, ticketsSold: 0 }],
    },
    {
      id: "selling",
      email: "vende@rifalo.do",
      emailConfirmed: true,
      orgs: [{ slug: "vende", plan: "free", stripeStatus: null, hasActiveRaffle: true, ticketsSold: 3 }],
    },
  ];

  it("keeps the excluded org list and drops test, unverified, and unsubscribed owners", () => {
    assert.deepEqual(
      [...BLOG_EMAIL_EXCLUDED_ORG_SLUGS],
      ["test", "test42323", "prueba-interna-test", "cura"],
    );
    const counts = classifyBlogAudiences(users, {
      unsubscribed: new Set(["baja@rifalo.do"]),
      blockedEmails: new Set(),
    });
    assert.deepEqual(counts.all.willSend.map((row) => row.userId), ["real-free", "paying", "selling"]);
    assert.deepEqual(counts.published.willSend.map((row) => row.userId), ["real-free", "selling"]);
    assert.deepEqual(counts.paying.willSend.map((row) => row.userId), ["paying"]);
    assert.deepEqual(counts.free.willSend.map((row) => row.userId), ["real-free", "selling"]);
    assert.deepEqual(counts.no_sales.willSend.map((row) => row.userId), ["real-free"]);
  });

  it("does not send the same post again while a delivery is sent or in flight", () => {
    const now = new Date("2026-11-21T12:00:00.000Z");
    assert.equal(deliveryBlocksResend({ status: "sent", claimedAt: "2026-11-20T12:00:00.000Z" }, now), true);
    assert.equal(deliveryBlocksResend({ status: "pending", claimedAt: "2026-11-21T11:55:00.000Z" }, now), true);
    assert.equal(deliveryBlocksResend({ status: "pending", claimedAt: "2026-11-21T11:00:00.000Z" }, now), false);
    assert.equal(deliveryBlocksResend({ status: "failed", claimedAt: "2026-11-21T11:55:00.000Z" }, now), false);

    const counts = classifyBlogAudiences(users, {
      unsubscribed: new Set(),
      blockedEmails: new Set(["plus@rifalo.do"]),
    });
    assert.equal(counts.paying.willSend.length, 0);
    assert.equal(counts.paying.alreadySent, 1);
  });
});

describe("robots policy", () => {
  it("adds the sitemap and blocks superadmin only on the marketing host", () => {
    assert.equal(isMarketingHost("rifalo.do", "rifalo.do"), true);
    assert.equal(isMarketingHost("www.rifalo.do", "rifalo.do"), true);
    assert.equal(isMarketingHost("demo.rifalo.do", "rifalo.do"), false);
    assert.equal(isMarketingHost("organizador.rifalo.do", "rifalo.do"), false);

    const marketing = buildRobots(true);
    const tenant = buildRobots(false);
    assert.equal(marketing.sitemap, "https://www.rifalo.do/sitemap.xml");
    assert.equal(tenant.sitemap, undefined);
    const marketingRules = marketing.rules as { disallow?: string }[];
    const tenantRules = tenant.rules as { disallow?: string }[];
    assert.ok(marketingRules.every((rule) => rule.disallow === "/superadmin"));
    assert.ok(tenantRules.every((rule) => rule.disallow === undefined));
  });
});

describe("home blog section", () => {
  it("keeps the three newest published posts and hides drafts", () => {
    const posts = [
      { ...loadBlogPosts()[0], slug: "viejo", date: "2026-01-01", published: true },
      { ...loadBlogPosts()[0], slug: "borrador", date: "2026-11-21", published: false },
      { ...loadBlogPosts()[0], slug: "medio", date: "2026-06-01", published: true },
      { ...loadBlogPosts()[0], slug: "nuevo", date: "2026-11-01", published: true },
      { ...loadBlogPosts()[0], slug: "cuarto", date: "2026-03-01", published: true },
    ];
    assert.deepEqual(
      latestPublishedBlogPosts(posts).map((post) => post.slug),
      ["nuevo", "medio", "cuarto"],
    );
    assert.deepEqual(latestPublishedBlogPosts(posts.filter((post) => !post.published)), []);
  });
});

describe("blog post route", () => {
  it("renders on each request so an unknown slug can 404", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/blog/[slug]/page.tsx"), "utf8");
    assert.match(source, /export const dynamic = ["']force-dynamic["']/);
  });
});

describe("marketing paths", () => {
  it("recognizes the blog and the unsubscribe page", () => {
    assert.equal(isMarketingBlogPath("/blog"), true);
    assert.equal(isMarketingBlogPath("/blog/como-vender-boletos-de-rifa"), true);
    assert.equal(isMarketingBlogPath("/blogger"), false);
    assert.equal(isBlogUnsubscribePath("/baja"), true);
    assert.equal(isBlogUnsubscribePath("/api/blog/unsubscribe"), true);
    assert.equal(isBlogUnsubscribePath("/signup"), false);
  });
});
