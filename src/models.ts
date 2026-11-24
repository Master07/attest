import { createRouter } from "@corbet/harness-core";
import type { ModelRole, ModelRoute, Provider } from "./types.js";

// Attest's route table. Resolution itself lives in the core router; this file only passes
// Attest's routes, providers, and environment variable names in.
export interface ProviderConfig {
  apiKeyEnv: string;
  baseUrlEnv: string;
  defaultBaseUrl?: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  meta: { apiKeyEnv: "MODEL_API_KEY", baseUrlEnv: "META_API_BASE_URL", defaultBaseUrl: "https://api.meta.ai/v1" },
  baseten: {
    apiKeyEnv: "BASETEN_API_KEY",
    baseUrlEnv: "BASETEN_BASE_URL",
    defaultBaseUrl: "https://inference.baseten.co/v1",
  },
};

export const MODEL_IDS = {
  spark: "muse-spark-1.3",
  sparkContributor: "muse-spark-1.3-contributor",
  wonder: "muse-wonder-1.0",
  wonderFull: "muse-wonder-full",
  image: "muse-image-1.0",
  sam: "sam-3.1",
  // Muse Spark Open on Baseten. The hackathon FAQ's ID ends in -1026; own Baseten accounts serve this one.
  sparkOpen: "meta-models/muse-spark-open",
} as const;

export const ROLE_ROUTE: Record<ModelRole, ModelRoute> = {
  worker: { provider: "meta", model: MODEL_IDS.spark },
  // Wonder Full is picker-only (Power/Maximum plan) with no API ID, so the API route uses Wonder.
  reasoning: { provider: "meta", model: MODEL_IDS.wonder },
  image: { provider: "meta", model: MODEL_IDS.image },
  ui: { provider: "meta", model: MODEL_IDS.sam },
  // The Model API's computer tool works on Spark 1.3; Wonder returns 400 Unsupported tool type.
  verifier: { provider: "meta", model: MODEL_IDS.spark },
  // Independent judge: a different model from the verifier. Muse Wonder is the fallback; the router
  // moves the judge to open weights (Muse Spark Open on Baseten) when a Baseten key is set or a
  // cassette replays.
  judge: { provider: "meta", model: MODEL_IDS.wonder },
};

const router = createRouter({
  envPrefix: "ATTEST_ROUTE_",
  routes: ROLE_ROUTE,
  providers: PROVIDERS,
  replayEnvVar: "ATTEST_REPLAY",
  openWeights: { role: "judge", provider: "baseten", route: { provider: "baseten", model: MODEL_IDS.sparkOpen } },
  contributorVariant: { role: "worker", route: { provider: "meta", model: MODEL_IDS.sparkContributor } },
});

export function pickRoute(role: ModelRole, contributor = false, env: NodeJS.ProcessEnv = process.env): ModelRoute {
  const resolved = router.resolve(role, { contributor, env });
  return { provider: resolved.provider as Provider, model: resolved.model };
}

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

export function resolveProvider(provider: Provider, env: NodeJS.ProcessEnv = process.env): ProviderEndpoint {
  return router.resolveProvider(provider, env);
}
