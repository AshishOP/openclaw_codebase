/**
 * Athena Memory Plugin Configuration
 *
 * Configuration schema for the Athena memory plugin.
 */

import path from "node:path";
import { homedir } from "node:os";

export type AthenaTransport = "stdio" | "sse";

export interface AthenaMemoryConfig {
  enabled: boolean;
  transport: AthenaTransport;
  pythonPath: string;
  athenaProjectDir: string;
  sseUrl: string;
  toolPrefix: string;
}

const DEFAULT_TOOL_PREFIX = "athena_";
const DEFAULT_PYTHON_PATH = "python3";
const DEFAULT_SSE_URL = "http://localhost:8765";

function resolveDefaultAthenaProjectDir(): string {
  // Default to Athena-Public sibling directory
  const home = homedir();
  const workspace = path.join(home, "Desktop", "openclaw_codebase");
  const athenaDir = path.join(workspace, "Athena-Public");
  return athenaDir;
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

export const athenaMemoryConfigSchema = {
  parse(value: unknown): AthenaMemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Athena memory config required");
    }

    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      ["enabled", "transport", "pythonPath", "athenaProjectDir", "sseUrl", "toolPrefix"],
      "Athena memory config",
    );

    const enabled = cfg.enabled === true;
    const transport = cfg.transport === "sse" ? "sse" : "stdio";

    const pythonPath =
      typeof cfg.pythonPath === "string"
        ? resolveEnvVars(cfg.pythonPath)
        : DEFAULT_PYTHON_PATH;

    const athenaProjectDir =
      typeof cfg.athenaProjectDir === "string"
        ? resolveEnvVars(cfg.athenaProjectDir)
        : resolveDefaultAthenaProjectDir();

    const sseUrl =
      typeof cfg.sseUrl === "string" ? resolveEnvVars(cfg.sseUrl) : DEFAULT_SSE_URL;

    const toolPrefix =
      typeof cfg.toolPrefix === "string" ? cfg.toolPrefix : DEFAULT_TOOL_PREFIX;

    return {
      enabled,
      transport,
      pythonPath,
      athenaProjectDir,
      sseUrl,
      toolPrefix,
    };
  },

  uiHints: {
    enabled: {
      label: "Enabled",
      help: "Enable Athena memory integration",
    },
    transport: {
      label: "Transport",
      help: "Connection method (stdio for subprocess, sse for HTTP)",
    },
    pythonPath: {
      label: "Python Path",
      placeholder: "python3",
      help: "Path to Python executable",
    },
    athenaProjectDir: {
      label: "Athena Project Directory",
      placeholder: "../Athena-Public",
      help: "Path to Athena-Public directory",
    },
    sseUrl: {
      label: "SSE URL",
      placeholder: "http://localhost:8765",
      help: "URL for SSE transport (used when transport=sse)",
    },
    toolPrefix: {
      label: "Tool Prefix",
      placeholder: "athena_",
      help: "Prefix for tool names",
    },
  },
};
