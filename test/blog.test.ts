import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOG_EMAIL_EXCLUDED_ORG_SLUGS,
  classifyBlogAudiences,
  deliveryBlocksResend,
  type AudienceUser,
} from "../src/lib/blog-audience.ts";
import {
  blogCoverPublicPath,
  blogStructuredData,
  isBlogPostVisible,
  loadBlogPosts,
  renderBlogBody,
  sitemapBlogPaths,
  visibleBlogPosts,
} from "../src/lib/blog.ts";
import { buildBlogEmail, withEmailUtms } from "../src/lib/blog-email.ts";
import { isBlogUnsubscribePath, isMarketingBlogPath } from "../src/lib/blog-paths.ts";
import { signBlogUnsubscribeToken, verifyBlogUnsubscribeToken } from "../src/lib/blog-unsubscribe.ts";

const SECRET = "test-secret";

describe("blog publish filter and sitemap", () => {
  const posts = loadBlogPosts();
  const post = posts.find((item) => item.slug === "como-vender-boletos-de-rifa");

  it("loads the first post as a draft with the brief's copy", () => {
    assert.ok(post);
    assert.equal(post.published, false);
    assert.equal(post.seoTitle, "Cómo vender boletos de rifa: lo que hace un organizador top");
    assert.equal(post.coverImage, "/blog/como-vender-boletos-de-rifa/cover.jpg");
    assert.equal(post.faq.length, 4);
    assert.equal(post.emailSubjects.length, 3);
    assert.equal(post.emailSubjects[0], "Organizador: esto hace el que más boletos vende en Rifalo");
    assert.match(post.body, /Link de la rifa en la bio de Instagram/);
    assert.match(renderBlogBody(post.body), /<ul class="blog-checklist">/);
  });

  it("hides unpublished posts in production and keeps them in preview", () => {
    assert.equal(visibleBlogPosts(posts, "production").length, 0);
    assert.equal(isBlogPostVisible(post!, "production"), false);
    assert.equal(visibleBlogPosts(posts, "preview").some((item) => item.slug === post!.slug), true);
    assert.equal(visibleBlogPosts(posts, undefined).some((item) => item.slug === post!.slug), true);
  });

  it("adds /blog to the sitemap and leaves drafts out", () => {
    assert.deepEqual(sitemapBlogPaths(posts), ["/blog"]);
    assert.deepEqual(
      sitemapBlogPaths([{ slug: "publicado", published: true }, { slug: "borrador", published: false }]),
      ["/blog", "/blog/publicado"],
    );
  });

  it("falls back to the generated OG image until the cover file exists", () => {
    assert.ok(post);
    const image = blogCoverPublicPath(post);
    assert.ok(image === post.coverImage || image === `/blog/${post.slug}/opengraph-image`);
  });

  it("builds Article and FAQ JSON-LD from the frontmatter", () => {
    assert.ok(post);
    const graph = blogStructuredData(post, "https://rifalo.do/blog/como-vender-boletos-de-rifa/opengraph-image");
    assert.equal(graph[0]["@type"], "Article");
    assert.equal(graph[1]["@type"], "FAQPage");
    const questions = graph[1].mainEntity as { name: string }[];
    assert.equal(questions[0].name, "¿A qué hora conviene promocionar una rifa?");
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
      orgs: [{ slug: "cura", plan: "plus", stripeStatus: "active", hasActiveRaffle: true }],
    },
    {
      id: "real-free",
      email: "libre@rifalo.do",
      emailConfirmed: true,
      orgs: [
        { slug: "test", plan: "unlimited", stripeStatus: "active", hasActiveRaffle: true },
        { slug: "real", plan: "free", stripeStatus: null, hasActiveRaffle: true },
      ],
    },
    {
      id: "unverified",
      email: "nuevo@rifalo.do",
      emailConfirmed: false,
      orgs: [{ slug: "real", plan: "plus", stripeStatus: "active", hasActiveRaffle: true }],
    },
    {
      id: "paying",
      email: "plus@rifalo.do",
      emailConfirmed: true,
      orgs: [{ slug: "real", plan: "plus", stripeStatus: "active", hasActiveRaffle: false }],
    },
    {
      id: "unsubscribed",
      email: "baja@rifalo.do",
      emailConfirmed: true,
      orgs: [{ slug: "real", plan: "free", stripeStatus: null, hasActiveRaffle: false }],
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
    assert.deepEqual(counts.all.willSend.map((row) => row.userId), ["real-free", "paying"]);
    assert.deepEqual(counts.published.willSend.map((row) => row.userId), ["real-free"]);
    assert.deepEqual(counts.paying.willSend.map((row) => row.userId), ["paying"]);
    assert.deepEqual(counts.free.willSend.map((row) => row.userId), ["real-free"]);
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
