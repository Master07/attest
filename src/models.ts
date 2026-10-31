import type { ModelRole, ModelRoute, Provider } from "./types.js";

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
  // The hackathon Baseten key only serves Muse Spark Open (ID from the hackathon FAQ).
  sparkOpen: "meta-models/muse-spark-open-1026",
} as const;

export const ROLE_ROUTE: Record<ModelRole, ModelRoute> = {
  worker: { provider: "meta", model: MODEL_IDS.spark },
  // Wonder Full is picker-only (Power/Maximum plan) with no API ID, so the API route uses Wonder.
  reasoning: { provider: "meta", model: MODEL_IDS.wonder },
  image: { provider: "meta", model: MODEL_IDS.image },
  ui: { provider: "meta", model: MODEL_IDS.sam },
  // The Model API's computer tool works on Spark 1.3; Wonder returns 400 Unsupported tool type.
  verifier: { provider: "meta", model: MODEL_IDS.spark },
  // Independent judge: a different model from the verifier. Muse Wonder needs no computer tool, so it
  // works here. With a Baseten key, ATTEST_ROUTE_JUDGE=baseten:<spark-open id> moves it to open weights.
  judge: { provider: "meta", model: MODEL_IDS.wonder },
};

function isProvider(value: string): value is Provider {
  return Object.hasOwn(PROVIDERS, value);
}

// ATTEST_ROUTE_<ROLE>="provider:model" overrides a role, e.g. ATTEST_ROUTE_WORKER=baseten:meta-models/muse-spark-open-1026.
function routeOverride(role: ModelRole, env: NodeJS.ProcessEnv): ModelRoute | undefined {
  const name = `ATTEST_ROUTE_${role.toUpperCase()}`;
  const raw = env[name]?.trim();
  if (!raw) return undefined;
  const sep = raw.indexOf(":");
  const provider = raw.slice(0, sep);
  const model = raw.slice(sep + 1);
  if (sep <= 0 || !model) throw new Error(`${name} must be "provider:model", got "${raw}"`);
  if (!isProvider(provider)) throw new Error(`${name}: unknown provider "${provider}"`);
  return { provider, model };
}

export function pickRoute(role: ModelRole, contributor = false, env: NodeJS.ProcessEnv = process.env): ModelRoute {
  const override = routeOverride(role, env);
  if (override) return override;
  const route = ROLE_ROUTE[role];
  if (role === "worker" && contributor && route.provider === "meta") {
    return { provider: "meta", model: MODEL_IDS.sparkContributor };
  }
  return route;
}

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

export function resolveProvider(provider: Provider, env: NodeJS.ProcessEnv = process.env): ProviderEndpoint {
  // Replays answer from a recorded cassette and never reach the network, so no key is needed.
  if (env.ATTEST_REPLAY) return { baseUrl: "replay://", apiKey: "replay" };
  const config = PROVIDERS[provider];
  // `||`, not `??`: an empty `KEY=` line in .env must fall back to the default.
  const baseUrl = env[config.baseUrlEnv] || config.defaultBaseUrl;
  const apiKey = env[config.apiKeyEnv] || undefined;
  if (!baseUrl) throw new Error(`${provider}: set ${config.baseUrlEnv}`);
  if (!apiKey) throw new Error(`${provider}: set ${config.apiKeyEnv}`);
  return { baseUrl, apiKey };
}
