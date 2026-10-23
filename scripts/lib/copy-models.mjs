/**
 * Copies every model definition from one Builder space to another, so a new
 * site can start from an existing site's schema instead of the template's
 * baseline models. Used by `seed-builder.mjs --models-from=<app>`.
 *
 * The source is read live from the Builder Admin API (each model's full
 * `everything` JSON), so changes made by hand in the Builder UI — added or
 * removed fields, preview URLs, model settings, models that only exist in the
 * UI — are cloned too, not just what the seed script created.
 *
 * Models are matched by name. A model missing from the target is created; one
 * that already exists (e.g. the built-in `page` model) is overwritten with the
 * source definition. `model`-type fields point at another model by id, and ids
 * differ per space, so those are rewritten to the target space's ids. Content
 * entries are not copied.
 */

import { GraphQLClient, gql } from "graphql-request";

const ADMIN_API = "https://cdn.builder.io/api/v2/admin";

const LIST_MODELS = gql`
  query {
    models {
      id
      name
      everything
    }
  }
`;

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

// Set by Builder per space (ids and audit fields), so never copied.
const SERVER_KEYS = [
  "id",
  "createdDate",
  "createdBy",
  "updatedAt",
  "lastUpdateBy",
  "lastUpdateSource",
  "apiGenerated",
];

// name and kind can't change on an existing model.
const IMMUTABLE_KEYS = ["name", "kind"];

const adminClient = (privateKey) =>
  new GraphQLClient(ADMIN_API, {
    headers: { Authorization: `Bearer ${privateKey}` },
  });

// Rewrites every `modelId` (at any depth, e.g. inside subFields) from a source
// model id to the matching target model id.
function remapModelIds(value, idMap) {
  if (Array.isArray(value)) return value.map((item) => remapModelIds(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === "modelId" && idMap.has(item) ? idMap.get(item) : remapModelIds(item, idMap),
      ])
    );
  }
  return value;
}

function portableBody(model) {
  const body = { ...model.everything };
  for (const key of SERVER_KEYS) delete body[key];
  // Copied webhooks would notify the source site when this site's content changes.
  body.webhooks = [];
  return body;
}

// Returns { names, created }: every copied model name and how many were new.
export async function copyModels(sourcePrivateKey, targetPrivateKey) {
  const source = adminClient(sourcePrivateKey);
  const target = adminClient(targetPrivateKey);
  const [{ models: sourceModels }, { models: targetModels }] = await Promise.all([
    source.request(LIST_MODELS),
    target.request(LIST_MODELS),
  ]);

  const targetIds = new Set(targetModels.map((m) => m.id));
  if (sourceModels.some((m) => targetIds.has(m.id))) {
    throw new Error("The source and target sites use the same Builder space.");
  }

  console.log(`Copying ${sourceModels.length} model(s) from the source space...\n`);
  const targetByName = new Map(targetModels.map((m) => [m.name, m]));
  const idMap = new Map();
  let created = 0;

  // Pass 1: make sure every model exists, so each source id has a target id
  // before any `model`-type field needs it (this also handles models that
  // reference each other).
  for (const model of sourceModels) {
    const existing = targetByName.get(model.name);
    if (existing) {
      idMap.set(model.id, existing.id);
      continue;
    }
    const { addModel } = await target.request(ADD_MODEL, {
      body: { ...portableBody(model), fields: [] },
    });
    idMap.set(model.id, addModel.id);
    created++;
    console.log(`✓ Created model "${model.name}".`);
  }

  // Pass 2: copy each model's settings and full fields array.
  for (const model of sourceModels) {
    const data = remapModelIds(portableBody(model), idMap);
    for (const key of IMMUTABLE_KEYS) delete data[key];
    await target.request(UPDATE_MODEL, { body: { id: idMap.get(model.id), data } });
    console.log(`✓ Copied the definition of "${model.name}".`);
  }

  return { names: sourceModels.map((m) => m.name), created };
}
