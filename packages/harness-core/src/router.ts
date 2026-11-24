// Model router: role → provider + model, overridable per role from the environment.
// The caller passes its env prefix, route table, and provider registry, so this file never
// names a product-specific variable and a new provider slots in without touching the router.

export interface ProviderConfig {
  apiKeyEnv: string;
  baseUrlEnv: string;
  defaultBaseUrl?: string;
}

export interface ModelRoute {
  provider: string;
  model: string;
}

export type RouteSource = "default" | "env" | "cassette";

export interface ResolvedRoute extends ModelRoute {
  source: RouteSource;
}

/** A role that prefers `route` when `provider`'s key is set or while replaying (e.g. the judge). */
export interface OpenWeightsRule {
  role: string;
  provider: string;
  route: ModelRoute;
}

/** A role with a contributor variant (e.g. the worker's contributor model). */
export interface ContributorVariant {
  role: string;
  route: ModelRoute;
}

export interface RouterOptions {
  /** Prefix for per-role overrides, e.g. "<prefix><ROLE>=provider:model". */
  envPrefix: string;
  routes: Record<string, ModelRoute>;
  providers: Record<string, ProviderConfig>;
  /** Name of the env var whose presence means answers come from a cassette, not the network. */
  replayEnvVar: string;
  openWeights?: OpenWeightsRule;
  contributorVariant?: ContributorVariant;
}

export interface ResolveOptions {
  contributor?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

export interface Router {
  resolve(role: string, opts?: ResolveOptions): ResolvedRoute;
  resolveProvider(provider: string, env?: NodeJS.ProcessEnv): ProviderEndpoint;
}

export function createRouter(options: RouterOptions): Router {
  const { envPrefix, routes, providers, replayEnvVar, openWeights, contributorVariant } = options;

  function resolve(role: string, opts: ResolveOptions = {}): ResolvedRoute {
    const env = opts.env ?? process.env;
    const name = `${envPrefix}${role.toUpperCase()}`;
    const raw = env[name]?.trim();
    if (raw) {
      const sep = raw.indexOf(":");
      const provider = raw.slice(0, sep);
      const model = raw.slice(sep + 1);
      if (sep <= 0 || !model) throw new Error(`${name} must be "provider:model", got "${raw}"`);
      if (!Object.hasOwn(providers, provider)) throw new Error(`${name}: unknown provider "${provider}"`);
      return { provider, model, source: "env" };
    }
    const keyEnv = openWeights !== undefined ? providers[openWeights.provider]?.apiKeyEnv : undefined;
    const keySet = keyEnv !== undefined && Boolean(env[keyEnv]);
    const replaying = Boolean(env[replayEnvVar]);
    if (openWeights !== undefined && role === openWeights.role && (keySet || replaying)) {
      return { ...openWeights.route, source: replaying ? "cassette" : "default" };
    }
    const route = routes[role];
    if (route === undefined) throw new Error(`unknown role "${role}"`);
    if (opts.contributor === true && contributorVariant !== undefined && role === contributorVariant.role &&
        route.provider === contributorVariant.route.provider) {
      return { ...contributorVariant.route, source: "default" };
    }
    return { ...route, source: "default" };
  }

  function resolveProvider(provider: string, env: NodeJS.ProcessEnv = process.env): ProviderEndpoint {
    // Replays answer from a recorded cassette and never reach the network, so no key is needed.
    if (env[replayEnvVar]) return { baseUrl: "replay://", apiKey: "replay" };
    const config = providers[provider];
    if (config === undefined) throw new Error(`${provider}: unknown provider`);
    // `||`, not `??`: an empty `KEY=` line must fall back to the default.
    const baseUrl = env[config.baseUrlEnv] || config.defaultBaseUrl;
    const apiKey = env[config.apiKeyEnv] || undefined;
    if (!baseUrl) throw new Error(`${provider}: set ${config.baseUrlEnv}`);
    if (!apiKey) throw new Error(`${provider}: set ${config.apiKeyEnv}`);
    return { baseUrl, apiKey };
  }

  return { resolve, resolveProvider };
}
