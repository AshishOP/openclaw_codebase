import { resolveEnvApiKey } from "../agents/model-auth.js";
import { buildNvidiaProvider } from "../agents/models-config.providers.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import { createAuthChoiceAgentModelNoter } from "./auth-choice.apply-helpers.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyDefaultModelChoice } from "./auth-choice.default-model.js";

const NVIDIA_DEFAULT_MODEL_REF = "nvidia/deepseek-ai/deepseek-v3.2";

export async function applyAuthChoiceNvidia(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "nvidia-api-key") {
    return null;
  }

  let nextConfig = params.config;
  let agentModelOverride: string | undefined;
  const noteAgentModel = createAuthChoiceAgentModelNoter(params);

  let hasCredential = false;
  const envKey = resolveEnvApiKey("nvidia");

  if (envKey) {
    const useExisting = await params.prompter.confirm({
      message: `Use existing NVIDIA_API_KEY (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
      initialValue: true,
    });
    if (useExisting) {
      hasCredential = true;
    }
  }

  if (!hasCredential) {
    const key = await params.prompter.text({
      message: "Enter NVIDIA NIM API key",
      placeholder: "nvapi-xxx...",
      validate: validateApiKeyInput,
    });
    const normalizedKey = normalizeApiKeyInput(String(key));
    
    // Store in environment format for the provider
    const nvidiaProvider = buildNvidiaProvider();
    nextConfig = {
      ...nextConfig,
      models: {
        ...nextConfig.models,
        providers: {
          ...nextConfig.models?.providers,
          nvidia: {
            ...nvidiaProvider,
            apiKey: normalizedKey,
          },
        },
      },
    };
  }

  // Apply default model choice
  const applied = await applyDefaultModelChoice({
    config: nextConfig,
    setDefaultModel: params.setDefaultModel,
    defaultModel: NVIDIA_DEFAULT_MODEL_REF,
    applyDefaultConfig: (cfg) => ({
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model: NVIDIA_DEFAULT_MODEL_REF,
        },
      },
    }),
    applyProviderConfig: (cfg) => {
      const nvidiaProvider = buildNvidiaProvider();
      return {
        ...cfg,
        models: {
          ...cfg.models,
          providers: {
            ...cfg.models?.providers,
            nvidia: nvidiaProvider,
          },
        },
      };
    },
    noteDefault: NVIDIA_DEFAULT_MODEL_REF,
    noteAgentModel,
    prompter: params.prompter,
  });

  nextConfig = applied.config;
  agentModelOverride = applied.agentModelOverride ?? agentModelOverride;

  return { config: nextConfig, agentModelOverride };
}