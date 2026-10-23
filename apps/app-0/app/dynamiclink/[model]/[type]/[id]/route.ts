import { NextResponse } from "next/server";

interface RouteParams {
  model: string;
  type: string;
  id: string;
}

interface FetchResult {
  url?: string;
  handle?: string;
}

// Models whose entries have no `url` field: the route is built from the
// entry's `handle` (see ArticleData in @repo/types and app/blogs/[handle]).
const HANDLE_BASED_MODELS: Record<string, (handle: string) => string> = {
  article: (handle) => `/blogs/${handle}`,
};

function toGraphQLModelName(model: string): string {
  return model.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

async function fetchContent(
  endpoint: string,
  graphQLQuery: string,
  model: string
): Promise<FetchResult | null> {
  const response = await fetch(`${endpoint}?query=${encodeURIComponent(graphQLQuery)}`, {
    headers: { "Content-Type": "application/json" },
  });
  const { data } = await response.json();
  const record = data?.[model]?.[0]?.data;
  if (!record) return null;
  return { url: record.url, handle: record.handle };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const { model, type, id } = await params;

  if (!model || !type || !id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apiKey = process.env.NEXT_PUBLIC_BUILDER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const endpoint = `https://cdn.builder.io/api/v3/graphql/${apiKey}`;
    const graphQLModel = toGraphQLModelName(model);
    const useHandle = model in HANDLE_BASED_MODELS;
    const dataFields = useHandle ? "handle" : "url";

    let graphQLQuery = `query { ${graphQLModel}(query: { id: "${id}" }) { data { ${dataFields} } } }`;
    let result = await fetchContent(endpoint, graphQLQuery, graphQLModel);

    if (!result) {
      const prefixedId = `${apiKey}_${id}`;
      graphQLQuery = `query { ${graphQLModel}(query: { id: "${prefixedId}" }) { data { ${dataFields} } } }`;
      result = await fetchContent(endpoint, graphQLQuery, graphQLModel);
    }

    if (result) {
      const handleMapper = HANDLE_BASED_MODELS[model];
      let destination: string | null = null;

      if (handleMapper && result.handle) {
        destination = handleMapper(result.handle);
      } else if (result.url) {
        destination = result.url;
      }

      if (destination) {
        return NextResponse.redirect(new URL(destination, _request.url), 307);
      }
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("DynamicLink redirect error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
