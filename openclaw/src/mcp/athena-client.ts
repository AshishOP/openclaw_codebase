/**
 * Athena MCP Client
 *
 * TypeScript client for connecting to Athena's MCP server.
 * Supports both stdio (subprocess) and SSE (HTTP) transports.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export type AthenaTransport = "stdio" | "sse";

export interface AthenaClientConfig {
  transport: AthenaTransport;
  pythonPath?: string;
  athenaProjectDir?: string;
  sseUrl?: string;
}

export interface AthenaToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Athena MCP Client
 *
 * Wraps the MCP SDK Client to connect to Athena's MCP server.
 * Must call connect() before making any tool calls.
 */
export class AthenaClient {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private config: AthenaClientConfig;
  private connected = false;

  constructor(config: AthenaClientConfig) {
    this.config = config;
  }

  /**
   * Connect to the Athena MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      if (this.config.transport === "stdio") {
        await this.connectStdio();
      } else {
        await this.connectSSE();
      }
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to Athena MCP server: ${error}`);
    }
  }

  /**
   * Connect using stdio transport (spawns Python subprocess)
   */
  private async connectStdio(): Promise<void> {
    const pythonPath = this.config.pythonPath || "python3";
    const cwd = this.config.athenaProjectDir || process.cwd();

    // Set PYTHONPATH to include the src directory so 'athena' module can be found
    // athena module is at: athenaProjectDir/src/athena/
    // So PYTHONPATH should be athenaProjectDir/src
    const srcPath = cwd.endsWith('/src') ? cwd : `${cwd}/src`;
    const env: Record<string, string> = {
      ...process.env,
      PYTHONPATH: srcPath,
    } as Record<string, string>;

    const transport = new StdioClientTransport({
      command: pythonPath,
      args: ["-m", "athena.mcp_server"],
      cwd,
      env,
    });

    this.transport = transport;

    this.client = new Client(
      { name: "openclaw-athena-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await this.client.connect(transport);
  }

  /**
   * Connect using SSE transport (HTTP connection)
   */
  private async connectSSE(): Promise<void> {
    const sseUrl = this.config.sseUrl || "http://localhost:8765";

    const transport = new SSEClientTransport(new URL(sseUrl));
    this.transport = transport;

    // Create and initialize the MCP client
    this.client = new Client(
      {
        name: "openclaw-athena-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await this.client.connect(transport);
  }

  /**
   * Call an Athena MCP tool
   *
   * @param name - The tool name (e.g., "smart_search", "quicksave")
   * @param args - The arguments to pass to the tool
   * @returns The tool result
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<AthenaToolResult> {
    if (!this.client || !this.connected) {
      throw new Error("AthenaClient not connected. Call connect() first.");
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      // Convert MCP result to our AthenaToolResult format
      const content = result.content.map((block): { type: "text"; text: string } => {
        if (block.type === "text") {
          return { type: "text", text: block.text };
        }
        return { type: "text", text: JSON.stringify(block) };
      });

      return {
        content,
        isError: result.isError,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Disconnect from the Athena MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this.transport = null;
    this.connected = false;
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
