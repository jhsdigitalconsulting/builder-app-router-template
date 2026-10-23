import type { Level1Item, Navigation } from "@repo/types";

interface NavigationData {
  data?: { level1?: Level1Item[] };
}

interface NavigationReferenceLike {
  value?: NavigationData;
  data?: { level1?: Level1Item[] };
}

// Returns the level-1 items of a navigation reference without trusting its
// shape: an enriched reference (`value.data.level1`), a raw Navigation entry
// (`data.level1`), or the fallback when neither holds an array.
export function getNavItems(nav: unknown, fallback: Navigation): Level1Item[] {
  if (nav && typeof nav === "object") {
    const ref = nav as NavigationReferenceLike;
    const fromValue = ref.value?.data?.level1;
    if (Array.isArray(fromValue)) return fromValue;
    const fromRaw = ref.data?.level1;
    if (Array.isArray(fromRaw)) return fromRaw;
  }
  const fromFallback = fallback.data?.level1;
  return Array.isArray(fromFallback) ? fromFallback : [];
}
