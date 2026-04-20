type ResolveBaseUrlOptions = {
  envValue?: string;
  fallbackBaseUrl: string;
  envName: string;
  isProduction: boolean;
};

export function resolveBaseUrl(options: ResolveBaseUrlOptions) {
  const normalizedEnvValue = options.envValue?.trim();
  if (normalizedEnvValue) {
    return normalizedEnvValue;
  }

  if (options.isProduction) {
    throw new Error(`${options.envName} is required in production builds.`);
  }

  return options.fallbackBaseUrl;
}
