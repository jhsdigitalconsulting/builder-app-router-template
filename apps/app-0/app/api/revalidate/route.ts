import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHash, timingSafeEqual } from "node:crypto";

// Maps a Builder.io model to the published path that must be revalidated.
// `page` revalidates its own `data.url`; `article` lives under a fixed route
// prefix keyed by `data.handle`, mirroring the blogs page route.
interface ModelConfig {
  field: string;
  toPath: (value: string) => string;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  page: { field: "url", toPath: (url) => url },
  article: { field: "handle", toPath: (handle) => `/blogs/${handle}` },
};

interface BuilderWebhookBody {
  // Builder.io nests the published entry under `newValue.data`; manual/test
  // payloads may send `data` at the top level instead.
  newValue?: { data?: Record<string, unknown> };
  data?: Record<string, unknown>;
  modelName?: string;
  operation?: string;
}

// Constant-time comparison. Hashing both values first gives equal-length
// buffers, so timingSafeEqual never throws and length isn't leaked either.
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function resolvePath(body: BuilderWebhookBody): string | null {
  const data = body.newValue?.data ?? body.data;
  if (!data) return null;

  const config = body.modelName ? MODEL_CONFIG[body.modelName] : undefined;
  if (config) {
    const value = data[config.field];
    if (typeof value === "string" && value) return config.toPath(value);
  }

  // Fallback for unknown/missing modelName: treat a bare `url` as a page path.
  if (typeof data.url === "string" && data.url) return data.url;

  return null;
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "REVALIDATE_SECRET is not configured" },
      { status: 500 }
    );
  }

  // Header only: a secret in the query string ends up in access logs.
  const provided = request.headers.get("x-revalidate-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  let body: BuilderWebhookBody = {};
  try {
    body = await request.json();
  } catch {
    // No/invalid JSON body — fall back to the `?path=` query param below.
  }

  const path = resolvePath(body) ?? new URL(request.url).searchParams.get("path");
  if (!path) {
    return NextResponse.json({ message: "Missing path" }, { status: 400 });
  }

  revalidatePath(path);
  // Keep the generated sitemap fresh when content is published or unpublished.
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ revalidated: true, path });
}
