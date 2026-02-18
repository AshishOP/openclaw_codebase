/**
 * OpenClaw Athena Memory Plugin
 *
 * Long-term memory integration via Athena MCP server.
 * Provides tools for searching, saving, and recalling memories from Athena.
 * Supports auto-recall and auto-capture lifecycle hooks.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { AthenaClient } from "../../src/mcp/athena-client.js";
import { athenaMemoryConfigSchema, type AthenaMemoryConfig } from "./config.js";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract text content from messages array (same pattern as memory-lancedb)
 */
function extractMessageTexts(messages: unknown[]): string[] {
  const texts: string[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      continue;
    }
    const msgObj = msg as Record<string, unknown>;
    const content = msgObj.content;

    if (typeof content === "string") {
      texts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === "object" &&
          "type" in block &&
          (block as Record<string, unknown>).type === "text" &&
          "text" in block &&
          typeof (block as Record<string, unknown>).text === "string"
        ) {
          texts.push((block as Record<string, unknown>).text as string);
        }
      }
    }
  }
  return texts;
}

/**
 * Parse smart_search results and extract readable text
 */
function parseSearchResults(resultText: string): string[] {
  try {
    const parsed = JSON.parse(resultText);
    const results = parsed.results?.results || [];
    return results.map(
      (r: { id: string; content: string; rrf_score: number }) =>
        `[${(r.rrf_score * 100).toFixed(1)}%] ${r.id}: ${r.content}`
    );
  } catch {
    return [resultText];
  }
}

/**
 * Check if conversation has enough exchanges to warrant saving (>= 2 user messages)
 */
function hasEnoughExchanges(messages: unknown[]): boolean {
  let userMessageCount = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const msgObj = msg as Record<string, unknown>;
    if (msgObj.role === "user") {
      userMessageCount++;
    }
  }
  return userMessageCount >= 2;
}

/**
 * Generate a summary from messages (first user message + last user message)
 */
function generateSummary(messages: unknown[]): string {
  // Collect first user message (topic) + last user message (outcome)
  let firstUserMsg = "";
  let lastUserMsg = "";

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const msgObj = msg as Record<string, unknown>;
    if (msgObj.role !== "user") continue;

    const content = msgObj.content;
    let text = "";
    if (typeof content === "string") {
      text = content.trim();
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block === "object" && "text" in block) {
          text += block.text as string;
        }
      }
      text = text.trim();
    }

    if (!text) continue;
    if (!firstUserMsg) firstUserMsg = text.slice(0, 80);
    lastUserMsg = text.slice(0, 80);
  }

  // If first and last are the same (only 1 message), just use it
  if (!firstUserMsg) return "Conversation with user";
  if (firstUserMsg === lastUserMsg) return firstUserMsg;

  // Combine: what started the conversation + how it ended
  return `${firstUserMsg} → ${lastUserMsg}`;
}

/**
 * Extract key facts from messages (user messages only)
 */
function extractKeyFacts(messages: unknown[]): string[] {
  const facts: string[] = [];
  const importantPatterns = [
    /\+\d{10,}/, // Phone numbers
    /[\w.-]+@[\w.-]+\.\w+/, // Emails
    /(my|name is|i'm|i am)\s+\w+/i, // Personal info
    /(prefer|like|love|hate|want|need)\s+/i, // Preferences
    /(remember|don't forget|make sure)\s+/i, // Important reminders
    /(decided|will use|going to)\s+/i, // Decisions
  ];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const msgObj = msg as Record<string, unknown>;
    if (msgObj.role !== "user") continue;

    const content = msgObj.content;
    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block === "object" && "text" in block) {
          text += (block.text as string) + " ";
        }
      }
    }

    for (const pattern of importantPatterns) {
      const match = text.match(pattern);
      if (match) {
        facts.push(match[0]);
      }
    }
  }

  return [...new Set(facts)].slice(0, 5);
}

// =============================================================================
// Plugin Definition
// =============================================================================

const athenaMemoryPlugin = {
  id: "memory-athena",
  name: "Memory (Athena)",
  description: "Athena MCP server-backed long-term memory with hybrid RAG search",
  kind: "memory" as const,
  configSchema: athenaMemoryConfigSchema,

  register(api: OpenClawPluginApi) {
    // api.pluginConfig contains the config object from entries.memory-athena.config
    // If plugin is selected via slots.memory, it's auto-enabled
    const cfg = athenaMemoryConfigSchema.parse(api.pluginConfig || {});

    // Log what we received for debugging
    api.logger.info(`memory-athena: received config: ${JSON.stringify(api.pluginConfig)}`);

    api.logger.info(
      `memory-athena: plugin registered (transport: ${cfg.transport}, project: ${cfg.athenaProjectDir})`
    );

    let athenaClient: AthenaClient | null = new AthenaClient({
      transport: cfg.transport,
      pythonPath: cfg.pythonPath,
      athenaProjectDir: cfg.athenaProjectDir,
      sseUrl: cfg.sseUrl,
    });

    // ========================================================================
    // Tools
    // ========================================================================

    api.registerTool(
      {
        name: `${cfg.toolPrefix}search`,
        label: "Athena Search",
        description:
          "Search Athena's knowledge base using hybrid RAG (Canonical + Tags + Vectors + GraphRAG).",
        parameters: Type.Object({
          query: Type.String({ description: "Search query" }),
          limit: Type.Optional(Type.Number({ description: "Max results (default: 10)" })),
          strict: Type.Optional(Type.Boolean({ description: "Filter low-confidence results" })),
          rerank: Type.Optional(Type.Boolean({ description: "Apply LLM reranking" })),
        }),
        async execute(_toolCallId, params) {
          const { query, limit = 10, strict = false, rerank = false } = params as {
            query: string;
            limit?: number;
            strict?: boolean;
            rerank?: boolean;
          };

          // Ensure connected before calling tool
          if (!athenaClient?.isConnected()) {
            await athenaClient?.connect();
          }

          const result = await athenaClient!.callTool("smart_search", {
            query,
            limit,
            strict,
            rerank,
          });

          return {
            content: result.content,
            isError: result.isError,
            details: result.content.map((c) => c.text).join("\n"),
          };
        },
      },
      { name: `${cfg.toolPrefix}search` }
    );

    api.registerTool(
      {
        name: `${cfg.toolPrefix}save`,
        label: "Athena Save",
        description: "Save a checkpoint to the current Athena session log.",
        parameters: Type.Object({
          summary: Type.String({ description: "Brief description" }),
          bullets: Type.Optional(
            Type.Array(Type.String(), { description: "Optional list of items" })
          ),
        }),
        async execute(_toolCallId, params) {
          const { summary, bullets } = params as {
            summary: string;
            bullets?: string[];
          };

          // Ensure connected before calling tool
          if (!athenaClient?.isConnected()) {
            await athenaClient?.connect();
          }

          const result = await athenaClient!.callTool("quicksave", {
            summary,
            bullets: bullets || null,
          });

          return {
            content: result.content,
            isError: result.isError,
            details: result.content.map((c) => c.text).join("\n"),
          };
        },
      },
      { name: `${cfg.toolPrefix}save` }
    );

    api.registerTool(
      {
        name: `${cfg.toolPrefix}recall_session`,
        label: "Athena Recall Session",
        description: "Retrieve recent session log content from Athena.",
        parameters: Type.Object({
          lines: Type.Optional(Type.Number({ description: "Number of lines (default: 50)" })),
        }),
        async execute(_toolCallId, params) {
          const { lines = 50 } = params as { lines?: number };

          // Ensure connected before calling tool
          if (!athenaClient?.isConnected()) {
            await athenaClient?.connect();
          }

          const result = await athenaClient!.callTool("recall_session", { lines });

          return {
            content: result.content,
            isError: result.isError,
            details: result.content.map((c) => c.text).join("\n"),
          };
        },
      },
      { name: `${cfg.toolPrefix}recall_session` }
    );

    api.registerTool(
      {
        name: `${cfg.toolPrefix}list_paths`,
        label: "Athena List Memory Paths",
        description: "List all active memory directories.",
        parameters: Type.Object({}),
        async execute(_toolCallId) {
          // Ensure connected before calling tool
          if (!athenaClient?.isConnected()) {
            await athenaClient?.connect();
          }

          const result = await athenaClient!.callTool("list_memory_paths", {});
          return {
            content: result.content,
            isError: result.isError,
            details: result.content.map((c) => c.text).join("\n"),
          };
        },
      },
      { name: `${cfg.toolPrefix}list_paths` }
    );

    api.registerTool(
      {
        name: `${cfg.toolPrefix}health`,
        label: "Athena Health Check",
        description: "Run a health audit of Athena's core services.",
        parameters: Type.Object({}),
        async execute(_toolCallId) {
          // Ensure connected before calling tool
          if (!athenaClient?.isConnected()) {
            await athenaClient?.connect();
          }

          const result = await athenaClient!.callTool("health_check", {});
          return {
            content: result.content,
            isError: result.isError,
            details: result.content.map((c) => c.text).join("\n"),
          };
        },
      },
      { name: `${cfg.toolPrefix}health` }
    );

    // ========================================================================
    // Lifecycle Hooks
    // ========================================================================

    // AUTO-RECALL
    api.on("before_agent_start", async (event) => {
      if (!athenaClient) return;

      try {
        await athenaClient.connect();
        api.logger.info("memory-athena: connected to MCP server");

        if (event.prompt && event.prompt.length > 0) {
          const userPrompt = Array.isArray(event.prompt)
            ? event.prompt.join(" ")
            : String(event.prompt);

          if (userPrompt.length > 10) {
            api.logger.info(`memory-athena: auto-recall for: ${userPrompt.slice(0, 50)}...`);

            const searchResult = await athenaClient.callTool("smart_search", {
              query: userPrompt,
              limit: 3,
              strict: false,
              rerank: false,
            });

            if (!searchResult.isError && searchResult.content.length > 0) {
              const resultText = searchResult.content[0].text;
              const parsed = JSON.parse(resultText);
              const results = parsed.results?.results || [];
              const meaningfulResults = results.filter(
                (r: { rrf_score: number }) => r.rrf_score > 0.01
              );

              if (meaningfulResults.length > 0) {
                const formattedResults = parseSearchResults(resultText);
                const contextMessage = `[Athena Memory] Relevant context from past sessions:\n${formattedResults.join("\n")}`;
                api.logger.info(`memory-athena: injecting ${meaningfulResults.length} memories`);
                return { prependContext: contextMessage };
              }
            }
          }
        }
      } catch (err) {
        api.logger.warn(`memory-athena: auto-recall failed: ${String(err)}`);
      }
    });

    // AUTO-CAPTURE
    api.on("agent_end", async (event) => {
      if (!athenaClient) return;

      try {
        if (!event.success || !event.messages || event.messages.length === 0) {
          await athenaClient.disconnect();
          return;
        }

        if (!hasEnoughExchanges(event.messages)) {
          api.logger.info("memory-athena: skipping capture (not enough exchanges)");
          await athenaClient.disconnect();
          return;
        }

        const summary = generateSummary(event.messages);
        const facts = extractKeyFacts(event.messages);

        api.logger.info(`memory-athena: auto-capturing: ${summary.slice(0, 50)}...`);

        const saveResult = await athenaClient.callTool("quicksave", {
          summary,
          bullets: facts.length > 0 ? facts : null,
        });

        if (saveResult.isError) {
          api.logger.warn(`memory-athena: auto-capture failed: ${saveResult.content[0]?.text}`);
        } else {
          api.logger.info("memory-athena: auto-capture completed");
        }

        await athenaClient.disconnect();
        api.logger.info("memory-athena: disconnected");
      } catch (err) {
        api.logger.warn(`memory-athena: agent_end error: ${String(err)}`);
        try { await athenaClient.disconnect(); } catch { /* ignore */ }
      }
    });

    // ========================================================================
    // Service
    // ========================================================================

    api.registerService({
      id: "memory-athena",
      start: () => {
        api.logger.info(`memory-athena: initialized (transport: ${cfg.transport})`);
      },
      stop: () => {
        api.logger.info("memory-athena: stopped");
      },
    });
  },
};

export default athenaMemoryPlugin;
