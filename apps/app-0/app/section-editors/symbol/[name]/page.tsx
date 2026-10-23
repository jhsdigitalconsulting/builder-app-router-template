import React from "react";
import { fetchOneEntry } from "@builder.io/sdk-react";
import RenderBuilderContent from "../../../../components/RenderBuilderContent";
import { BUILDER_API_KEY, getSiteContext } from "../../../../lib/builder";

// The editor must always see live (including unpublished) symbol content.
export const dynamic = "force-dynamic";

interface SymbolEditorPageProps {
  params: Promise<{ name: string }>;
}

// A space with no symbols yet has no `symbol` model at all, so the Content API
// answers 404 "Model not found" and the SDK throws. Treat that as "no symbol"
// so the editor still opens with an empty canvas. Other failures (network,
// auth, 5xx) also fail open, but are logged.
async function fetchSymbol(name: string) {
  try {
    return await fetchOneEntry({
      model: "symbol",
      apiKey: BUILDER_API_KEY,
      query: { name },
      enrich: true,
      includeUnpublished: true,
      locale: "Default",
      fetchOptions: { cache: "no-store" },
    });
  } catch (error) {
    console.error("[symbol-editor] failed to load symbol", name, error);
    return null;
  }
}

function decodeName(rawName: string): string {
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

// Builder.io editor entry for a symbol, loaded by name. `_` (or an empty name)
// renders an empty editor canvas. The Site context is passed as `data` so
// bindings such as `state.siteContext.*` resolve while editing.
export default async function SymbolEditorPage({
  params,
}: SymbolEditorPageProps) {
  const { name: rawName } = await params;
  const name = decodeName(rawName);
  const lookup = name !== "" && name !== "_";

  const [symbol, siteContext] = await Promise.all([
    lookup ? fetchSymbol(name) : Promise.resolve(null),
    getSiteContext("en"),
  ]);

  return (
    <RenderBuilderContent
      content={symbol ?? null}
      model="symbol"
      locale="Default"
      data={{ siteContext }}
    />
  );
}
