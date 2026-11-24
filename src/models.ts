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
  // OpenAI-compatible judge endpoint (OpenRouter, etc.). No default base URL: the
  // caller must set ATTEST_OPENAI_COMPAT_BASE_URL. The bearer credential comes from
  // the variable named by ATTEST_OPENAI_COMPAT_KEY_ENV (default OPENAI_COMPAT_API_KEY).
  "openai-compat": { apiKeyEnv: "OPENAI_COMPAT_API_KEY", baseUrlEnv: "ATTEST_OPENAI_COMPAT_BASE_URL" },
};

export const OPENAI_COMPAT_DEFAULT_KEY_ENV = "OPENAI_COMPAT_API_KEY";

/** Route-time validation of the openai-compat base URL, mirroring the core contract. */
function validateOpenAICompatBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("openai-compat: invalid base URL");
  }
  const httpLoopback = url.protocol === "http:" && url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !httpLoopback) {
    throw new Error("openai-compat: base URL must use https: (http: is allowed only for 127.0.0.1)");
  }
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new Error("openai-compat: base URL must not contain credentials, a query or a fragment");
  }
}

/** Resolve the openai-compat endpoint: required base URL, selectable key variable. */
function resolveOpenAICompat(env: NodeJS.ProcessEnv): ProviderEndpoint {
  const baseUrl = env.ATTEST_OPENAI_COMPAT_BASE_URL;
  if (!baseUrl) throw new Error("openai-compat: set ATTEST_OPENAI_COMPAT_BASE_URL");
  // `||`, not `??`: an empty KEY_ENV line falls back to the default.
  const keyEnv = env.ATTEST_OPENAI_COMPAT_KEY_ENV || OPENAI_COMPAT_DEFAULT_KEY_ENV;
  const apiKey = env[keyEnv];
  if (!apiKey) throw new Error(`openai-compat: set ${keyEnv}`);
  validateOpenAICompatBaseUrl(baseUrl);
  return { baseUrl, apiKey };
}

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
  if (resolved.provider === "openai-compat") {
    // Fail at route-resolve time, before any fetch: the judge would otherwise
    // report this as a missing vote. Same rules and messages as resolveProvider;
    // the key itself is still checked at call time, and nothing is echoed.
    const baseUrl = env.ATTEST_OPENAI_COMPAT_BASE_URL;
    if (!baseUrl) throw new Error("openai-compat: set ATTEST_OPENAI_COMPAT_BASE_URL");
    validateOpenAICompatBaseUrl(baseUrl);
  }
  return { provider: resolved.provider as Provider, model: resolved.model };
}

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

export function resolveProvider(provider: Provider, env: NodeJS.ProcessEnv = process.env): ProviderEndpoint {
  // Replays answer from a cassette and never reach the network, so the generic
  // router (which short-circuits on ATTEST_REPLAY before reading keys) handles
  // them for every provider, including openai-compat.
  if (provider === "openai-compat" && !env.ATTEST_REPLAY) return resolveOpenAICompat(env);
  return router.resolveProvider(provider, env);
}
