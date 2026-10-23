/**
 * Builder.io provisioning / seed script.
 *
 * Run this once when bootstrapping a new Builder space from this template:
 *
 *   pnpm --filter app-0 init:builder    (replace app-0 with your app name)
 *
 * It is idempotent — re-running it will skip anything that already exists.
 *
 * What it does:
 *   1. Creates the `site-context` data model (via the Builder Admin GraphQL
 *      API — the `addModel` mutation). The app's RootLayout calls
 *      `getSiteContext()` which queries this model; without it the SDK throws
 *      "Error fetching data."
 *   2. Creates the `article` section model used by the /blogs/[handle] route and
 *      the sitemap. Without it `next build` fails collecting that route with
 *      "Model not found" when fetchEntries({ model: "article" }) 404s.
 *      Using `kind: "section"` because articles are fetched by `data.handle`
 *      rather than URL path — they appear under "Section models" in Builder.
 *   3. Creates the `navigation` data model and adds the header/footer
 *      navigation reference fields to `site-context`. DefaultHeader and
 *      DefaultFooter read `siteContext.data.headerNavigation1/2` and
 *      `footerNavigation1` (resolved via `enrich: true`); without these the
 *      header/footer fall back to empty menus.
 *   4. Creates the shared `metadata` data model (SEO description + keywords) and
 *      adds it as a `model`-type field to both the `article` and built-in `page`
 *      models, so every model that maps 1:1 to a web page exposes the same
 *      `data.metadata` shape (the `Metadata` type in @repo/types).
 *   5. Sets the Dynamic Preview URL logic (`editingUrlLogic` — the code-mode
 *      preview URL) on the built-in `page` model and the `article` model so the
 *      Builder editor previews against the running app's routes.
 *   6. Creates the `url-redirect` data model — a single entry holding a
 *      `redirects` list (urlFrom, urlTo, permanentRedirect). The main app's
 *      next.config.ts `redirects()` fetches this at build time and hands the
 *      rules to Next.js. Without the model that build-time fetch 404s.
 *   7. Seeds a default `site-context` entry, a sample `article` entry, sample
 *      header + footer `navigation` entries, and a sample `url-redirect` entry
 *      (via the Builder Write REST API), then wires the navigation references
 *      onto the `site-context` entry so real menus render on first run. NOTE:
 *      the Admin GraphQL API has no content-write mutation, so content creation
 *      must go through the Write API. Model = GraphQL, content = REST.
 *
 * Credentials are read from the .env.local of the app it runs in (the
 * `--filter` target; falls back to the first site app under apps/):
 *   - BUILDER_PRIVATE_KEY          (bpk-...)  — required, for writes
 *   - NEXT_PUBLIC_BUILDER_API_KEY             — required, to check existing content
 *   - NEXT_PUBLIC_SITE_CONTEXT_NAME           — entry name the app queries by
 *
 * Cloning another site's models instead of steps 1–6:
 *
 *   pnpm --filter <app> init:builder --models-from=<other-app>
 *
 * copies every model definition from <other-app>'s Builder space as it is now
 * (including changes made in the Builder UI), using the private key in that
 * app's .env.local. Step 7 still seeds the sample content, skipping any model
 * the copied schema doesn't have. See scripts/lib/copy-models.mjs.
 */

import { GraphQLClient, gql } from "graphql-request";
import { readFileSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { ROOT, findCurrentApp, findSiteApps } from "./lib/apps.mjs";
import { readPrivateKey } from "./lib/files.mjs";
import { copyModels } from "./lib/copy-models.mjs";

// The app being seeded — the one `pnpm --filter <app> init:builder` runs in.
const APP = findCurrentApp();

// `--models-from=<app>` clones that site's models instead of the baseline ones.
const MODELS_FROM =
  process.argv.find((arg) => arg.startsWith("--models-from="))?.split("=")[1] || "";

// --- Load .env.local (standalone node scripts don't get Next's env loading) ---
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(APP.path, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // No .env.local — fall back to whatever is already in the environment.
  }
}
loadEnvLocal();

const PRIVATE_KEY = process.env.BUILDER_PRIVATE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_BUILDER_API_KEY;
const CMS_LINK_PLUGIN_URL = process.env.BUILDER_CMS_LINK_PLUGIN_URL || "";
const SITE_CONTEXT_NAME =
  process.env.NEXT_PUBLIC_SITE_CONTEXT_NAME || "builder-app-template";
const BUILDER_SITE_URL = process.env.BUILDER_SITE_URL || "";
const BUILDER_SPACE_DESCRIPTION = process.env.BUILDER_SPACE_DESCRIPTION || "";
// Placeholder image text naming the site, e.g. "amicosecurity" → ?text=amicosecurity.
const SITE_NAME_IMAGE_TEXT = encodeURIComponent(SITE_CONTEXT_NAME).replace(/%20/g, "+");

const MODEL_NAME = "site-context";
const ARTICLE_MODEL_NAME = "article";
const NAV_MODEL_NAME = "navigation";
// Shared SEO metadata model, referenced as a `model`-type field by every model
// that maps 1:1 to a web page (article, page) so they share one metadata shape.
const METADATA_MODEL_NAME = "metadata";
// URL redirect model — a single entry holds a list of redirect rules that the
// main app's next.config.ts applies at build time.
const URL_REDIRECT_MODEL_NAME = "url-redirect";
// Builder's built-in catch-all page model (not created by this script).
const PAGE_MODEL_NAME = "page";
// Builder's built-in symbol model (not created by this script).
const SYMBOL_MODEL_NAME = "symbol";
const ADMIN_API = "https://cdn.builder.io/api/v2/admin";
const writeApi = (model) => `https://builder.io/api/v1/write/${model}`;
const writeUpdateApi = (model, id) =>
  `https://builder.io/api/v1/write/${model}/${id}`;

// A Builder reference value (write shape). When the entry is later fetched with
// `enrich: true`, Builder resolves this into { "@type", id, model, value }.
const referenceValue = (model, id) => ({
  "@type": "@builder.io/core:Reference",
  model,
  id,
});

if (!PRIVATE_KEY) {
  console.error("✗ BUILDER_PRIVATE_KEY is missing from the main app's .env.local");
  process.exit(1);
}
if (!PUBLIC_KEY) {
  console.error("✗ NEXT_PUBLIC_BUILDER_API_KEY is missing from the main app's .env.local");
  process.exit(1);
}

const client = new GraphQLClient(ADMIN_API, {
  headers: { Authorization: `Bearer ${PRIVATE_KEY}` },
});

// --- Field helper: Builder fills in the rest of the defaults server-side. ---
const field = (name, type, extra = {}) => ({
  "@type": "@builder.io/core:Field",
  name,
  type,
  required: false,
  helperText: "",
  subFields: [],
  ...extra,
});

// A `model`-type field embeds another model's schema inline. We use it to give
// every page-like model the same `metadata` shape (resolves to the `Metadata`
// type in @repo/types). The target model is referenced by `modelId`, which is
// resolved at runtime (it differs per Builder space).
const metadataField = (modelId) =>
  field("metadata", "model", {
    modelId,
    helperText: "Shared SEO metadata (description + keywords).",
  });

// --- Navigation reference fields added to site-context. Each points at the
// `navigation` model; DefaultHeader/DefaultFooter consume the enriched values. ---
const SITE_CONTEXT_NAV_FIELDS = [
  field("headerNavigation1", "reference", {
    model: NAV_MODEL_NAME,
    helperText: "Primary header navigation (references a navigation entry).",
  }),
  field("headerNavigation2", "reference", {
    model: NAV_MODEL_NAME,
    helperText: "Secondary header navigation (optional).",
  }),
  field("footerNavigation1", "reference", {
    model: NAV_MODEL_NAME,
    helperText: "Footer navigation (references a navigation entry).",
  }),
];

// --- site-context model definition (mirrors the SiteContext type in @repo/types) ---
const MODEL_BODY = {
  name: MODEL_NAME,
  kind: "data",
  showTargeting: false,
  fields: [
    field("siteName", "text", {
      helperText: "Display name of the site, used in metadata and schema.",
      defaultValue: "Builder App Template",
    }),
    field("logo", "file", {
      helperText: "Site logo image (used by the header and organization schema).",
      allowedFileTypes: ["jpeg", "jpg", "png", "svg", "webp"],
      defaultValue: "https://placehold.co/400x100.png?text=Logo",
    }),
    field("organization", "object", {
      helperText: "Legal/organization details for SEO schema.",
      subFields: [
        field("name", "text", { defaultValue: "Builder App Template" }),
        field("description", "longText"),
        field("address", "object", {
          subFields: [
            field("address1", "text"),
            field("city", "text"),
            field("state", "text"),
            field("postalCode", "text"),
            field("country", "text", { defaultValue: "US" }),
          ],
        }),
      ],
    }),
    field("contact", "object", {
      helperText: "Primary contact details for organization schema.",
      subFields: [
        field("telephone", "text"),
        field("email", "text"),
        field("areaServed", "text"),
        field("availableLanguages", "list", {
          helperText: "Languages the organization serves customers in.",
          subFields: [field("language", "text")],
        }),
      ],
    }),
    field("socialNetworks", "list", {
      helperText: "Social profile links (rendered in the footer + schema sameAs).",
      subFields: [field("name", "text"), field("href", "url")],
    }),
    field("googleAnalyticsId", "text", {
      helperText: "Google Analytics measurement ID (e.g. G-XXXXXXX).",
    }),
    ...SITE_CONTEXT_NAV_FIELDS,
  ],
};

// --- Default content seeded into the new model ---
const DEFAULT_DATA = {
  siteName: SITE_CONTEXT_NAME,
  logo: `https://placehold.co/400x100.png?text=${SITE_NAME_IMAGE_TEXT}`,
  organization: {
    name: SITE_CONTEXT_NAME,
    description:
      "A starter template for building sites with Builder.io and the Next.js App Router.",
    address: {
      address1: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
    },
  },
  contact: {
    telephone: "+1-555-555-5555",
    email: "hello@example.com",
    areaServed: "US",
    availableLanguages: [{ language: "English" }],
  },
  socialNetworks: [
    { name: "Twitter", href: "https://twitter.com" },
    { name: "LinkedIn", href: "https://www.linkedin.com" },
  ],
  googleAnalyticsId: "",
};

// --- Dynamic Preview URL logic (Builder's `editingUrlLogic` on the model). ---
// This is the "code" version of the preview URL (the `< >` toggle in the editor),
// stored as a JS function body. Builder evaluates it to build the live preview
// URL. Available objects include `space`, `content`, `targeting`, `locale`, etc.
// NOTE: `examplePageUrl` is a SEPARATE field holding a static example URL — JS
// logic must go in `editingUrlLogic` or it won't be treated as code.
// See https://www.builder.io/c/docs/dynamic-preview-urls.

// The page model is the catch-all route — preview the urlPath directly.
const PAGE_PREVIEW_URL_LOGIC = "return `${space.siteUrl}${targeting.urlPath}`;";

// Articles render at /blogs/<handle>; fall back to localhost when no site URL
// is configured on the space.
const ARTICLE_PREVIEW_URL_LOGIC = [
  "const baseUrl = space.siteUrl || 'http://localhost:3000';",
  "return `${baseUrl}/blogs/${content.data.handle || '_'}?preview=true`;",
].join("\n");

// Symbols render at /section-editors/symbol via a static editor entry page
// (there's no per-symbol route — the name is only used as a query hint).
const SYMBOL_PREVIEW_URL_LOGIC =
  "return `${space.siteUrl}/section-editors/symbol/${content.name || '_'}?preview=true`;";

// --- metadata model definition (mirrors the Metadata type in @repo/types) ---
// kind: "data" — a small reusable SEO block embedded via `model`-type fields.
const METADATA_MODEL_BODY = {
  name: METADATA_MODEL_NAME,
  kind: "data",
  showTargeting: false,
  fields: [
    field("description", "text", {
      helperText: "SEO meta description for the page.",
    }),
    field("keywords", "Tags", {
      helperText: "SEO keywords for the page.",
    }),
    field("breadcrumbTitle", "text", {
      helperText:
        "Short label to use for this page in breadcrumb trails, overriding the page title.",
    }),
  ],
};

// --- article model definition (mirrors ArticleData in @repo/types) ---
// kind: "component" — this is Builder's internal name for what the sidebar
// labels "Section models". Articles carry visual-editor blocks but are
// fetched by data.handle rather than URL path, so they belong here rather
// than under "Page models" (kind: "page").
const ARTICLE_MODEL_BODY = {
  name: ARTICLE_MODEL_NAME,
  kind: "component",
  showTargeting: false,
  editingUrlLogic: ARTICLE_PREVIEW_URL_LOGIC,
  fields: [
    field("handle", "text", {
      helperText: "URL slug for the article (used at /blogs/<handle>).",
      required: true,
    }),
    field("title", "text", { helperText: "Article headline." }),
    field("subtitle", "text", { helperText: "Article subtitle / eyebrow." }),
    field("image", "file", {
      helperText: "Hero image for the article.",
      allowedFileTypes: ["jpeg", "jpg", "png", "svg", "webp"],
    }),
    field("excerpt", "longText", {
      helperText: "Short summary shown in listings and the hero.",
    }),
    field("publishDate", "date", {
      helperText: "Publication date (used for schema + display).",
    }),
    // The `metadata` model-field is appended at runtime (it needs the resolved
    // metadata model id) — see main().
  ],
};

const SAMPLE_ARTICLE_HANDLE = "hello-world";

const SAMPLE_ARTICLE_DATA = {
  handle: SAMPLE_ARTICLE_HANDLE,
  title: "Hello World",
  subtitle: "Your first article",
  image: "https://placehold.co/800x600/EEE/5ce1e6.png",
  excerpt:
    "A sample article seeded by the template. Edit or delete it in the Builder.io editor.",
  publishDate: "2024-01-01",
  metadata: {
    description: "A sample article seeded by the Builder App Template.",
    keywords: ["builder.io", "template", "blog"],
  },
};

// A CMSLink value (see CMSLinkProps in @repo/types) pointing at a plain URL.
// Every link field in this project uses the CMSLink editor from the
// @jhsdc/builder-input-types plugin, so seeded content stores links in the
// same shape.
const urlLink = (href) => ({ type: "url", href });

const NAV_HREF_HELPER =
  "Where this item links to: a page or entry in Builder, or an external URL.";

// --- navigation model definition (mirrors NavigationData in @repo/types) ---
// kind: "data" — entries are a nested level1 → level2 → level3 menu tree.
const NAV_MODEL_BODY = {
  name: NAV_MODEL_NAME,
  kind: "data",
  showTargeting: false,
  fields: [
    field("level1", "list", {
      helperText: "Top-level navigation items.",
      subFields: [
        field("text", "text", { required: true }),
        field("href", "CMSLink", { helperText: NAV_HREF_HELPER }),
        field("level2", "list", {
          helperText: "Dropdown items under this top-level item.",
          subFields: [
            field("text", "text", { required: true }),
            field("href", "CMSLink", { helperText: NAV_HREF_HELPER }),
            field("level3", "list", {
              helperText: "Nested items under this dropdown item.",
              subFields: [
                field("text", "text", { required: true }),
                field("href", "CMSLink", { helperText: NAV_HREF_HELPER }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
};

const PRIMARY_NAV_NAME = "primary-navigation";
const PRIMARY_NAV_DATA = {
  level1: [
    { text: "Home", href: urlLink("/") },
    {
      text: "About",
      href: urlLink("/about"),
      level2: [
        { text: "Our Story", href: urlLink("/about/our-story") },
        { text: "Team", href: urlLink("/about/team") },
      ],
    },
    {
      text: "Blogs",
      href: urlLink("/blogs"),
      level2: [
        { text: "Hello World", href: urlLink("/blogs/hello-world") },
      ],
    },
    { text: "Contact", href: urlLink("/contact") },
  ],
};

const FOOTER_NAV_NAME = "footer-navigation";
const FOOTER_NAV_DATA = {
  level1: [
    { text: "Home", href: urlLink("/") },
    { text: "About", href: urlLink("/about") },
    { text: "Blog", href: urlLink("/blogs") },
    { text: "Contact", href: urlLink("/contact") },
  ],
};

// --- url-redirect model definition (mirrors UrlRedirectData in @repo/types) ---
// kind: "data" — a single entry holds a `redirects` list. next.config.ts fetches
// this list at build time and returns it from Next.js's `redirects()` (so editors
// manage redirects in the Builder UI; changes take effect on the next deploy).
const URL_REDIRECT_MODEL_BODY = {
  name: URL_REDIRECT_MODEL_NAME,
  kind: "data",
  showTargeting: false,
  fields: [
    field("redirects", "list", {
      helperText:
        "Redirect rules applied at build time. Paths support Next.js matching, e.g. /old/:slug*.",
      subFields: [
        field("urlFrom", "text", {
          required: true,
          helperText: "Source path to match, e.g. /old-page or /blog/:slug*.",
        }),
        field("urlTo", "text", {
          required: true,
          helperText: "Destination path or URL, e.g. /new-page or /posts/:slug*.",
        }),
        field("permanentRedirect", "boolean", {
          defaultValue: true,
          helperText: "On → 308 (permanent). Off → 307 (temporary).",
        }),
      ],
    }),
  ],
};

const URL_REDIRECT_ENTRY_NAME = "redirects";
const URL_REDIRECT_DATA = {
  redirects: [
    {
      urlFrom: "/old-home",
      urlTo: "/",
      permanentRedirect: true,
    },
  ],
};

// --- Home page seeded into the built-in `page` model at URL path "/" ---
const HOME_PAGE_NAME = "home";

const HOME_PAGE_DATA = {
  url: "/",
  title: "Home",
};

// URL targeting so fetchOneEntry({ userAttributes: { urlPath: "/" } }) matches.
const HOME_PAGE_QUERY = [
  { property: "urlPath", operator: "is", value: "/" },
];

const HOME_PAGE_BLOCKS = [
  // --- Hero: Banner100 with TileContent on the left + Image on the right ---
  // IDs are intentionally omitted — Builder.io auto-generates proper builder-{hex}
  // IDs, which are required for blocks to be editable in the visual editor.
  {
    "@type": "@builder.io/sdk:Element",
    component: {
      name: "Banner100",
      options: {
        theme: "light",
        backgroundType: "none",
        fullWidth: true,
        alignment: "left",
        content: {
          blocks: [
            {
              "@type": "@builder.io/sdk:Element",
              responsiveStyles: {
                large: {
                  display: "flex",
                  gap: "48px",
                  alignItems: "center",
                  width: "100%",
                  padding: "60px 40px",
                  maxWidth: "1200px",
                  margin: "0 auto",
                },
                small: {
                  flexDirection: "column",
                  padding: "32px 20px",
                },
              },
              children: [
                {
                  "@type": "@builder.io/sdk:Element",
                  component: {
                    name: "TileContent",
                    options: {
                      theme: "light",
                      inheritTheme: true,
                      alignment: "left",
                      maskOpacity: 0,
                      // The site name shows which site this page was seeded for.
                      eyebrow: `${SITE_CONTEXT_NAME} · Builder.io + Next.js App Router`,
                      headline: `Welcome to ${SITE_CONTEXT_NAME}`,
                      content:
                        `<p>This home page was generated for the <strong>${SITE_CONTEXT_NAME}</strong> site by <code>pnpm configure</code>.</p>` +
                        "<p>This template comes pre-wired with visual editing, a blog system, navigation management, SEO tooling, URL redirects, and a themeable component library — all out of the box. Open the Builder.io editor to start customizing, or explore the code to understand how everything fits together.</p>",
                    },
                  },
                  responsiveStyles: {
                    large: { flex: "1", minWidth: "0" },
                  },
                },
                {
                  "@type": "@builder.io/sdk:Element",
                  component: {
                    name: "Image",
                    options: {
                      image: `https://placehold.co/600x400.png?text=${SITE_NAME_IMAGE_TEXT}`,
                      altText: `${SITE_CONTEXT_NAME} site preview`,
                    },
                  },
                  responsiveStyles: {
                    large: { flex: "1", minWidth: "0", height: "360px" },
                    small: { width: "100%", height: "220px" },
                  },
                },
              ],
            },
          ],
        },
      },
    },
    responsiveStyles: {
      large: { display: "block" },
    },
  },

  // --- FAQ: Core:Section wrapping Accordion ---
  {
    "@type": "@builder.io/sdk:Element",
    component: {
      name: "Core:Section",
      options: {
        maxWidth: 1200,
        lazyLoad: false,
      },
    },
    responsiveStyles: {
      large: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
        flexShrink: "0",
        boxSizing: "border-box",
        marginTop: "0px",
        paddingLeft: "20px",
        paddingRight: "20px",
        paddingTop: "20px",
        paddingBottom: "20px",
        minHeight: "100px",
      },
    },
    children: [
      {
        "@type": "@builder.io/sdk:Element",
        component: {
          name: "Accordion",
          options: {
            theme: "light",
            headline: "Frequently Asked Questions",
            groups: [
              {
                headline: "What is this template?",
                content: {
                  blocks: [
                    {
                      "@type": "@builder.io/sdk:Element",
                      component: {
                        name: "Text",
                        options: {
                          text: "<p>This is a production-ready Next.js App Router starter integrated with Builder.io for visual content editing. It includes a blog system, site-context for global settings, navigation management, URL redirect rules, and a shared component library built with Tailwind CSS.</p>",
                        },
                      },
                    },
                  ],
                },
              },
              {
                headline: "How do I edit this page visually?",
                content: {
                  blocks: [
                    {
                      "@type": "@builder.io/sdk:Element",
                      component: {
                        name: "Text",
                        options: {
                          text: "<p>Open your Builder.io space and navigate to <strong>Pages</strong>. Click the <em>Home</em> entry to open it in the visual editor. From there you can drag-and-drop components, edit text inline, and publish changes without touching code.</p>",
                        },
                      },
                    },
                  ],
                },
              },
              {
                headline: "How do I add a new page?",
                content: {
                  blocks: [
                    {
                      "@type": "@builder.io/sdk:Element",
                      component: {
                        name: "Text",
                        options: {
                          text: "<p>In Builder.io, go to <strong>Pages → New Entry</strong>. Set the URL path (e.g. <code>/about</code>), add your components, and publish. The Next.js catch-all route (<code>[[...page]]</code>) automatically serves every published page entry.</p>",
                        },
                      },
                    },
                  ],
                },
              },
              {
                headline: "How do I add my own components?",
                content: {
                  blocks: [
                    {
                      "@type": "@builder.io/sdk:Element",
                      component: {
                        name: "Text",
                        options: {
                          text: "<p>Create a folder under <code>packages/components/components/{category}/{Name}/</code> with an <code>index.tsx</code> and a <code>{Name}.builder.registration.tsx</code>. Register it in the matching <code>registry/{category}.ts</code> barrel and add it to an insert menu. Run <code>/new-component</code> in Claude Code to scaffold everything automatically.</p>",
                        },
                      },
                    },
                  ],
                },
              },
              {
                headline: "How do I manage the header and footer navigation?",
                content: {
                  blocks: [
                    {
                      "@type": "@builder.io/sdk:Element",
                      component: {
                        name: "Text",
                        options: {
                          text: "<p>Navigation menus are stored in the <strong>navigation</strong> data model in Builder.io. Edit the <em>primary-navigation</em> entry to update the header menu and the <em>footer-navigation</em> entry for the footer. Changes publish instantly without a redeploy.</p>",
                        },
                      },
                    },
                  ],
                },
              },
              {
                headline: "How do I set up URL redirects?",
                content: {
                  blocks: [
                    {
                      "@type": "@builder.io/sdk:Element",
                      component: {
                        name: "Text",
                        options: {
                          text: "<p>Open the <strong>url-redirect</strong> data model in Builder.io and edit the <em>redirects</em> entry. Add rows with <em>urlFrom</em>, <em>urlTo</em>, and whether it is permanent (308) or temporary (307). Redirect rules are applied by Next.js on the next deploy.</p>",
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        responsiveStyles: {
          large: { display: "block" },
        },
      },
    ],
  },
];

const ADD_MODEL = gql`
  mutation addModel($body: JSONObject!) {
    addModel(body: $body) {
      id
      name
    }
  }
`;

const UPDATE_MODEL = gql`
  mutation updateModel($body: UpdateModelInput!) {
    updateModel(body: $body) {
      id
      name
    }
  }
`;

// `settings` is a JSON scalar holding the space document (name, siteUrl, ...).
const SPACE_SETTINGS = gql`
  query {
    settings
  }
`;

const UPDATE_SPACE_PROPERTIES = gql`
  mutation updateSpaceProperties($properties: SpacePropertiesInput!) {
    updateSpaceProperties(properties: $properties)
  }
`;

const LIST_MODELS = gql`
  query {
    models {
      id
      name
      kind
      fields
      examplePageUrl
      everything
    }
  }
`;

// Returns true if it created the model, false if it already existed.
async function ensureModel(modelBody, existingNames) {
  if (existingNames.has(modelBody.name)) {
    console.log(`• Model "${modelBody.name}" already exists — skipping creation.`);
    return false;
  }
  const { addModel } = await client.request(ADD_MODEL, { body: modelBody });
  console.log(`✓ Created model "${addModel.name}" (id: ${addModel.id}).`);
  return true;
}

// Like ensureModel but returns the model's id (whether it already existed or
// was just created). Used for the metadata model, whose id other models embed.
async function ensureModelReturningId(modelBody, models) {
  const existing = models.find((m) => m.name === modelBody.name);
  if (existing) {
    console.log(`• Model "${modelBody.name}" already exists — skipping creation.`);
    return existing.id;
  }
  const { addModel } = await client.request(ADD_MODEL, { body: modelBody });
  console.log(`✓ Created model "${addModel.name}" (id: ${addModel.id}).`);
  return addModel.id;
}

// Appends any of `requiredFields` missing from an existing model. Used to add
// the navigation reference fields to a `site-context` model that predates them,
// and the shared `metadata` field to the article/page models.
// `models` is the list fetched at startup (includes id, kind, fields).
async function ensureModelHasFields(modelName, requiredFields, models) {
  const model = models.find((m) => m.name === modelName);
  if (!model) {
    console.log(`• Model "${modelName}" not found — skipping field check.`);
    return;
  }
  const existing = Array.isArray(model.fields) ? model.fields : [];
  const existingNames = new Set(existing.map((f) => f.name));
  const missing = requiredFields.filter((f) => !existingNames.has(f.name));
  if (missing.length === 0) {
    console.log(`• Model "${modelName}" already has required field(s) — skipping.`);
    return;
  }
  // UpdateModelInput is { id, data } — and name/kind are immutable, so the
  // `data` payload carries only the (full) replacement fields array.
  const newFields = [...existing, ...missing];
  await client.request(UPDATE_MODEL, {
    body: { id: model.id, data: { fields: newFields } },
  });
  // Keep the in-memory model in sync so later mutations (e.g. removeModelField)
  // build on this updated fields array rather than clobbering it.
  model.fields = newFields;
  console.log(
    `✓ Added ${missing.map((f) => `"${f.name}"`).join(", ")} field(s) to "${modelName}".`
  );
}

// Switches every `href` field in an existing model (at any list depth) to the
// CMSLink type. ensureModelHasFields only adds missing fields, so a navigation
// model created before the CMSLink conversion still has `url` href fields.
// Idempotent: no-ops once every href is already CMSLink.
async function ensureHrefFieldsUseCMSLink(modelName, models) {
  const model = models.find((m) => m.name === modelName);
  if (!model) {
    console.log(`• Model "${modelName}" not found — skipping CMSLink check.`);
    return;
  }
  let changed = false;
  const convert = (fields) =>
    fields.map((f) => {
      const next = { ...f };
      if (next.name === "href" && next.type !== "CMSLink") {
        next.type = "CMSLink";
        next.helperText = NAV_HREF_HELPER;
        changed = true;
      }
      if (Array.isArray(next.subFields)) next.subFields = convert(next.subFields);
      return next;
    });
  const newFields = convert(Array.isArray(model.fields) ? model.fields : []);
  if (!changed) {
    console.log(`• Model "${modelName}" href fields already use CMSLink — skipping.`);
    return;
  }
  await client.request(UPDATE_MODEL, {
    body: { id: model.id, data: { fields: newFields } },
  });
  model.fields = newFields;
  console.log(`✓ Switched "${modelName}" href fields to CMSLink.`);
}

// Removes a field from an existing model if present. Used to drop the orphaned
// top-level `description` field from the built-in `page` model — SEO description
// now lives on the shared `metadata` model-field. Idempotent: no-ops when the
// field is already gone (e.g. a fresh Builder space).
async function removeModelField(modelName, fieldName, models) {
  const model = models.find((m) => m.name === modelName);
  if (!model) {
    console.log(`• Model "${modelName}" not found — skipping field removal.`);
    return;
  }
  const existing = Array.isArray(model.fields) ? model.fields : [];
  if (!existing.some((f) => f.name === fieldName)) {
    console.log(`• Model "${modelName}" has no "${fieldName}" field — skipping removal.`);
    return;
  }
  const newFields = existing.filter((f) => f.name !== fieldName);
  await client.request(UPDATE_MODEL, {
    body: { id: model.id, data: { fields: newFields } },
  });
  model.fields = newFields;
  console.log(`✓ Removed "${fieldName}" field from "${modelName}".`);
}

// Sets the model's Dynamic Preview URL logic — the code-mode preview URL stored
// in `editingUrlLogic` (NOT `examplePageUrl`, which holds a static example URL).
// `models` is the startup list (each model carries `everything`, the full model
// JSON, where `editingUrlLogic` lives). Idempotent and non-clobbering: it skips
// when the existing logic already contains our `return` statement (so a
// hand-edited value with Builder's comment header is preserved), and it clears
// any stale JS that an earlier version of this script wrote into examplePageUrl.
async function ensurePreviewUrl(modelName, logic, models) {
  const model = models.find((m) => m.name === modelName);
  if (!model) {
    console.log(`• Model "${modelName}" not found — skipping preview URL.`);
    return;
  }

  const current = model.everything?.editingUrlLogic || "";
  // The return statement is the signature — present whether or not Builder's
  // boilerplate comment header wraps it.
  const signature =
    logic.split("\n").find((line) => line.trim().startsWith("return")) || logic;

  const data = {};
  if (!current.includes(signature)) data.editingUrlLogic = logic;

  // Self-heal: an earlier version wrote JS into examplePageUrl (a static-URL
  // field). If it looks like code, clear it so only editingUrlLogic holds logic.
  const example = model.examplePageUrl || "";
  if (example.includes("return ") || example.trimStart().startsWith("const ")) {
    data.examplePageUrl = "";
  }

  if (Object.keys(data).length === 0) {
    console.log(`• Model "${modelName}" preview URL already set — skipping.`);
    return;
  }

  await client.request(UPDATE_MODEL, { body: { id: model.id, data } });
  console.log(`✓ Set preview URL logic on "${modelName}".`);
}

// Builder.io does not expose a plugin-install mutation in the Admin GraphQL API,
// and the plugin registry endpoint requires user-session auth rather than a
// private key. Print instructions so the developer can complete the step manually.
//
// The @jhsdc/builder-input-types plugin provides the `CMSLink` custom input type
// used by the DynamicLink component. Without it, any component that declares an
// input with type: "CMSLink" will fall back to a plain text field in the editor.
//
// How to install:
//   1. Build the plugin:  cd <plugin-repo>/plugins/builder-input-types && pnpm build
//   2. Host `dist/plugin.system.js` (e.g. deploy to Vercel, Netlify, or a CDN).
//   3. In Builder.io → Space Settings → Plugins → "Add plugin" → paste the hosted URL.
function printPluginReminder(pluginUrl) {
  console.log("\n⚠ Manual step required — install the CMSLink plugin in Builder.io:");
  console.log("  1. Build @jhsdc/builder-input-types and host plugin.system.js.");
  if (pluginUrl) {
    console.log(`  2. Plugin URL configured: ${pluginUrl}`);
    console.log("  3. In Builder.io → Space Settings → Plugins → Add plugin → paste the URL above.");
  } else {
    console.log("  2. In Builder.io → Space Settings → Plugins → Add plugin → paste the hosted URL.");
    console.log("     (Set BUILDER_CMS_LINK_PLUGIN_URL in .env.local to suppress this reminder.)");
  }
  console.log("  Without the plugin, CMSLink inputs appear as plain text in the editor.");
}

// Sets the space's Site URL (Settings → Space), which the editor uses as the
// preview base URL (`space.siteUrl` in the model preview URL logic). The Admin
// API's updateSpaceProperties mutation only accepts siteUrl, and it rejects
// URLs Builder can't reach (e.g. localhost) — those must be set in the UI.
async function ensureSiteUrl(siteUrl) {
  if (!siteUrl) return;
  try {
    const { settings } = await client.request(SPACE_SETTINGS);
    if (settings?.siteUrl === siteUrl) {
      console.log(`✓ Space Site URL already set to ${siteUrl}`);
      return;
    }
    await client.request(UPDATE_SPACE_PROPERTIES, { properties: { siteUrl } });
    console.log(`✓ Set space Site URL → ${siteUrl}`);
  } catch (err) {
    const reason = err.response?.errors?.[0]?.message || err.message;
    console.log(`\n⚠ Builder refused the Site URL (${reason}).`);
    console.log("  Set it manually in Builder.io → Settings → Space:");
    console.log(`  • Site URL → ${siteUrl}`);
  }
}

// The space description has no Admin API mutation, so it must be applied
// manually via the UI.
function printSpaceDescriptionReminder(description) {
  if (!description) return;
  console.log("\n⚠ One manual step required in Builder.io → Settings → Space:");
  console.log(`  • Description → ${description}`);
  console.log("  The description cannot be set via the Admin API and must be saved through the UI.");
}

// Returns the first matching content entry, or null.
async function getEntry(model, name) {
  const url =
    `https://cdn.builder.io/api/v3/content/${model}` +
    `?apiKey=${PUBLIC_KEY}` +
    `&query.name=${encodeURIComponent(name)}` +
    `&limit=1&cachebust=true&noTargeting=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json.results) && json.results.length > 0
    ? json.results[0]
    : null;
}

// Creates the entry if it doesn't exist. Returns the entry id either way.
// `extra` is merged into the top-level POST body (e.g. { blocks, query } for page entries).
async function ensureContent(model, name, data, extra = {}) {
  const existing = await getEntry(model, name);
  if (existing) {
    console.log(
      `• Entry "${name}" already exists in "${model}" — skipping seed.`
    );
    return existing.id;
  }
  const res = await fetch(writeApi(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, published: "published", data, ...extra }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Write API failed (${res.status}): ${text}`);
  }
  const created = await res.json();
  console.log(`✓ Seeded "${model}" entry "${name}" (id: ${created.id}).`);
  return created.id;
}

// Rewrites plain-string hrefs in an existing navigation entry as CMSLink
// values, so the CMSLink editor can open them. Entries seeded before the
// CMSLink conversion stored hrefs as strings. Idempotent.
async function migrateNavEntryLinks(name) {
  const existing = await getEntry(NAV_MODEL_NAME, name);
  if (!existing) return;
  let changed = false;
  const convert = (items) =>
    (items || []).map((item) => {
      const next = { ...item };
      if (typeof next.href === "string") {
        next.href = urlLink(next.href);
        changed = true;
      }
      if (Array.isArray(next.level2)) next.level2 = convert(next.level2);
      if (Array.isArray(next.level3)) next.level3 = convert(next.level3);
      return next;
    });
  const data = existing.data || {};
  const level1 = convert(data.level1);
  if (!changed) {
    console.log(`• Entry "${name}" links already use CMSLink — skipping.`);
    return;
  }
  const res = await fetch(writeUpdateApi(NAV_MODEL_NAME, existing.id), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { ...data, level1 } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Write API failed (${res.status}): ${text}`);
  }
  console.log(`✓ Converted "${name}" links to CMSLink values.`);
}

// Seeds the site-context entry wired to the navigation entries, or patches an
// existing entry to add any missing navigation references. Sends the full
// merged `data` so the PATCH can't drop unrelated fields.
async function ensureSiteContext(headerNavId, footerNavId) {
  const refs = {};
  if (headerNavId)
    refs.headerNavigation1 = referenceValue(NAV_MODEL_NAME, headerNavId);
  if (footerNavId)
    refs.footerNavigation1 = referenceValue(NAV_MODEL_NAME, footerNavId);

  const existing = await getEntry(MODEL_NAME, SITE_CONTEXT_NAME);
  if (!existing) {
    const res = await fetch(writeApi(MODEL_NAME), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: SITE_CONTEXT_NAME,
        published: "published",
        data: { ...DEFAULT_DATA, ...refs },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Write API failed (${res.status}): ${text}`);
    }
    const created = await res.json();
    console.log(
      `✓ Seeded "${MODEL_NAME}" entry "${SITE_CONTEXT_NAME}" with navigation references (id: ${created.id}).`
    );
    return;
  }

  // Existing entry: only add references it's missing, then PATCH the merged data.
  const data = existing.data || {};
  const patch = {};
  if (headerNavId && !data.headerNavigation1)
    patch.headerNavigation1 = refs.headerNavigation1;
  if (footerNavId && !data.footerNavigation1)
    patch.footerNavigation1 = refs.footerNavigation1;

  if (Object.keys(patch).length === 0) {
    console.log(`• "${SITE_CONTEXT_NAME}" already wired to navigation — skipping.`);
    return;
  }

  const res = await fetch(writeUpdateApi(MODEL_NAME, existing.id), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { ...data, ...patch } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Write API failed (${res.status}): ${text}`);
  }
  console.log(
    `✓ Wired ${Object.keys(patch).map((k) => `"${k}"`).join(", ")} on "${SITE_CONTEXT_NAME}".`
  );
}

// Seeds or updates the home page. The Gen 2 SDK reads content.data.blocks,
// so blocks must be written into data.blocks (not top-level blocks).
async function ensureHomePage() {
  let id;
  const existing = await getEntry(PAGE_MODEL_NAME, HOME_PAGE_NAME);
  if (existing) {
    id = existing.id;
  } else {
    const res = await fetch(writeApi(PAGE_MODEL_NAME), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: HOME_PAGE_NAME,
        published: "published",
        data: HOME_PAGE_DATA,
        query: HOME_PAGE_QUERY,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Write API failed (${res.status}): ${text}`);
    }
    const created = await res.json();
    id = created.id;
    console.log(`✓ Created "page" entry "${HOME_PAGE_NAME}" (id: ${id}).`);
    // Give the CDN a moment to register the new entry before patching.
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Always patch with blocks nested inside data — the Gen 2 SDK reads
  // content.data.blocks and the CDN v3 API surfaces data sub-fields.
  const patchRes = await fetch(writeUpdateApi(PAGE_MODEL_NAME, id), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: { ...HOME_PAGE_DATA, blocks: HOME_PAGE_BLOCKS },
      blocks: HOME_PAGE_BLOCKS,
      query: HOME_PAGE_QUERY,
    }),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text();
    throw new Error(`Write API failed (${patchRes.status}): ${text}`);
  }
  console.log(`✓ Applied blocks to "page" entry "${HOME_PAGE_NAME}" (data.blocks + top-level blocks).`);
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err) => resolve(err.code === "EADDRINUSE"));
    server.once("listening", () => { server.close(); resolve(false); });
    server.listen(port);
  });
}

async function ensureDevServerRunning() {
  const url = `http://localhost:${APP.port}`;
  const running = await isPortInUse(APP.port);
  if (running) {
    console.log(`• Dev server already running at ${url} — skipping start.`);
    return;
  }
  console.log(`\nStarting ${APP.name} dev server...`);
  // The server outlives this script, so its output goes to a log file rather
  // than the terminal — otherwise request logs keep printing over later
  // prompts (e.g. the rest of `pnpm configure`).
  const logPath = join(APP.path, "dev-server.log");
  const log = openSync(logPath, "a");
  const dev = spawn("pnpm", ["--filter", APP.name, "dev"], {
    cwd: ROOT,
    stdio: ["ignore", log, log],
    detached: true,
  });
  dev.unref();
  closeSync(log); // the child holds its own copy of the descriptor
  console.log(`✓ Dev server starting at ${url}`);
  console.log(`  Logs: apps/${APP.dir}/dev-server.log (stop it with: kill $(lsof -ti:${APP.port}))\n`);
}

// Creates the template's baseline models, or brings older spaces up to date.
// Returns true if it created any model.
async function provisionBaselineModels() {
  const { models } = await client.request(LIST_MODELS);
  const existingNames = new Set(models.map((m) => m.name));

  const createdSiteContext = await ensureModel(MODEL_BODY, existingNames);

  // The metadata model must exist before article/page can embed it: a
  // `model`-type field points at it by id, which differs per Builder space.
  const metadataModelId = await ensureModelReturningId(METADATA_MODEL_BODY, models);
  const metaField = metadataField(metadataModelId);

  // A pre-existing metadata model may predate newer SEO fields (e.g.
  // breadcrumbTitle) — retrofit them so older spaces stay in sync.
  await ensureModelHasFields(
    METADATA_MODEL_NAME,
    [
      field("breadcrumbTitle", "text", {
        helperText:
          "Short label to use for this page in breadcrumb trails, overriding the page title.",
      }),
    ],
    models
  );

  // Give a freshly-created article the metadata field at creation time.
  ARTICLE_MODEL_BODY.fields.push(metaField);
  const createdArticle = await ensureModel(ARTICLE_MODEL_BODY, existingNames);
  const createdNav = await ensureModel(NAV_MODEL_BODY, existingNames);
  const createdUrlRedirect = await ensureModel(
    URL_REDIRECT_MODEL_BODY,
    existingNames
  );

  // A pre-existing site-context model predates the navigation reference fields
  // (which a fresh MODEL_BODY already includes) — add them so the header/footer
  // can resolve real menus.
  if (!createdSiteContext) {
    await ensureModelHasFields(MODEL_NAME, SITE_CONTEXT_NAV_FIELDS, models);
  }

  // Every page-like model shares the same metadata shape. The built-in `page`
  // model always needs it added; an existing `article` model (one that predates
  // this field, or was created before the push above ran) gets it here too.
  if (!createdArticle) {
    await ensureModelHasFields(ARTICLE_MODEL_NAME, [metaField], models);
  }
  await ensureModelHasFields(PAGE_MODEL_NAME, [metaField], models);

  // The page model's old top-level `description` field is orphaned — SEO
  // description now comes from the shared `metadata` model-field.
  await removeModelField(PAGE_MODEL_NAME, "description", models);

  // Dynamic preview URLs: the built-in `page` model always needs it set here;
  // the `article` model gets it from ARTICLE_MODEL_BODY when freshly created,
  // otherwise update the existing model.
  // A navigation model created before the CMSLink conversion has `url` hrefs.
  if (!createdNav) {
    await ensureHrefFieldsUseCMSLink(NAV_MODEL_NAME, models);
  }

  await ensurePreviewUrl(PAGE_MODEL_NAME, PAGE_PREVIEW_URL_LOGIC, models);
  if (!createdArticle) {
    await ensurePreviewUrl(ARTICLE_MODEL_NAME, ARTICLE_PREVIEW_URL_LOGIC, models);
  }
  // The built-in `symbol` model is never created by this script, so always
  // update it directly (there's no "freshly created" branch to skip here).
  await ensurePreviewUrl(SYMBOL_MODEL_NAME, SYMBOL_PREVIEW_URL_LOGIC, models);

  return createdSiteContext || createdArticle || createdNav || createdUrlRedirect;
}

// Clones another site's model definitions as they are now in its space,
// including anything changed by hand in the Builder UI. The baseline retrofits
// are skipped so they don't re-add fields the source site removed.
// Returns true if it created any model.
async function provisionModelsFrom(appRef) {
  const source = findSiteApps().find((app) => app.dir === appRef || app.name === appRef);
  if (!source) throw new Error(`--models-from: no site app named "${appRef}".`);
  const sourceKey = readPrivateKey(source);
  if (!sourceKey) {
    throw new Error(`--models-from: apps/${source.dir}/.env.local has no BUILDER_PRIVATE_KEY.`);
  }
  console.log(`Model configuration: copied from ${source.dir}'s Builder space.`);
  const { created } = await copyModels(sourceKey, PRIVATE_KEY);
  return created > 0;
}

async function main() {
  console.log(`\nProvisioning Builder space for ${APP.name}...\n`);

  const createdModels = MODELS_FROM
    ? await provisionModelsFrom(MODELS_FROM)
    : await provisionBaselineModels();

  // The CDN takes a moment to register a brand-new model before it will
  // accept writes against it.
  if (createdModels) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  // A copied schema may not include every model the sample content needs.
  const { models } = await client.request(LIST_MODELS);
  const modelNames = new Set(models.map((m) => m.name));
  const hasModel = (name) => {
    if (modelNames.has(name)) return true;
    console.log(`• Model "${name}" not in this space — skipping its sample content.`);
    return false;
  };

  if (hasModel(ARTICLE_MODEL_NAME)) {
    await ensureContent(
      ARTICLE_MODEL_NAME,
      SAMPLE_ARTICLE_HANDLE,
      SAMPLE_ARTICLE_DATA
    );
  }

  // Seed the sample menus first, then wire their ids onto site-context.
  let headerNavId = null;
  let footerNavId = null;
  if (hasModel(NAV_MODEL_NAME)) {
    headerNavId = await ensureContent(
      NAV_MODEL_NAME,
      PRIMARY_NAV_NAME,
      PRIMARY_NAV_DATA
    );
    footerNavId = await ensureContent(
      NAV_MODEL_NAME,
      FOOTER_NAV_NAME,
      FOOTER_NAV_DATA
    );
    await migrateNavEntryLinks(PRIMARY_NAV_NAME);
    await migrateNavEntryLinks(FOOTER_NAV_NAME);
  }
  if (hasModel(MODEL_NAME)) {
    await ensureSiteContext(headerNavId, footerNavId);
  }

  // Seed the sample redirect entry. next.config.ts reads this model by name at
  // build time, so a single well-known entry name keeps the lookup simple.
  if (hasModel(URL_REDIRECT_MODEL_NAME)) {
    await ensureContent(
      URL_REDIRECT_MODEL_NAME,
      URL_REDIRECT_ENTRY_NAME,
      URL_REDIRECT_DATA
    );
  }

  // Seed the home page at "/". The built-in `page` model is catch-all; we set
  // URL targeting via `query` so fetchOneEntry({ urlPath: "/" }) resolves it.
  // ensureHomePage always patches blocks so re-runs keep the page in sync.
  await ensureHomePage();

  // The Site URL is set through the Admin API; the description has no
  // mutation, so remind the user to apply it in the Builder.io Settings UI.
  await ensureSiteUrl(BUILDER_SITE_URL);
  printSpaceDescriptionReminder(BUILDER_SPACE_DESCRIPTION);

  // The CMSLink plugin must be installed manually via the Builder.io UI.
  printPluginReminder(CMS_LINK_PLUGIN_URL);

  console.log("\nDone.\n");

  await ensureDevServerRunning();
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message || err);
  process.exit(1);
});
