/**
 * MCP client integrations — config snippets and install targets for every
 * major AI IDE/agent. They all speak MCP over stdio; only the config file
 * location and format differ.
 *
 * The server auto-loads GMI_API_KEY from ~/.config/gmi/.env, so configs don't
 * need to embed the key (but an env block is supported everywhere).
 */
import { homedir } from "node:os";
import { join } from "node:path";

export const SERVER_NAME = "gmi-studio";

/** The stdio server entry every client config points at. */
export function serverEntry(serverPath: string): { command: string; args: string[] } {
  return { command: "node", args: [serverPath] };
}

function mcpServersJson(serverPath: string): string {
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: serverEntry(serverPath) } }, null, 2);
}

export interface ClientSpec {
  id: string;
  name: string;
  /** Absolute path of the config file, when the client uses a well-known one. */
  configPath?: string;
  /** How to apply it: json-merge installable, or manual instructions only. */
  installable: boolean;
  snippet: (serverPath: string) => string;
  notes?: string;
}

const home = homedir();
const isMac = process.platform === "darwin";

export const CLIENTS: ClientSpec[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    installable: false,
    snippet: (p) => `claude mcp add ${SERVER_NAME} -- node "${p}"`,
    notes: "Run this in your terminal. Add -s user to register it for every project.",
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    configPath: isMac
      ? join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : join(home, ".config", "Claude", "claude_desktop_config.json"),
    installable: true,
    snippet: mcpServersJson,
  },
  {
    id: "cursor",
    name: "Cursor",
    configPath: join(home, ".cursor", "mcp.json"),
    installable: true,
    snippet: mcpServersJson,
    notes: "Global config shown; use <project>/.cursor/mcp.json for per-project setup.",
  },
  {
    id: "windsurf",
    name: "Windsurf (Cognition)",
    configPath: join(home, ".codeium", "windsurf", "mcp_config.json"),
    installable: true,
    snippet: mcpServersJson,
  },
  {
    id: "cline",
    name: "Cline (VS Code)",
    configPath: isMac
      ? join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json")
      : join(home, ".config", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
    installable: true,
    snippet: mcpServersJson,
    notes: "Or paste via Cline's UI: MCP Servers icon → Configure MCP Servers.",
  },
  {
    id: "kilo",
    name: "Kilo Code (VS Code)",
    configPath: isMac
      ? join(home, "Library", "Application Support", "Code", "User", "globalStorage", "kilocode.kilo-code", "settings", "mcp_settings.json")
      : join(home, ".config", "Code", "User", "globalStorage", "kilocode.kilo-code", "settings", "mcp_settings.json"),
    installable: true,
    snippet: mcpServersJson,
    notes: "Or paste via Kilo's UI: MCP Servers → Edit Global MCP.",
  },
  {
    id: "codex",
    name: "OpenAI Codex CLI",
    configPath: join(home, ".codex", "config.toml"),
    installable: false,
    snippet: (p) =>
      [`# add to ~/.codex/config.toml`, `[mcp_servers.${SERVER_NAME.replace(/-/g, "_")}]`, `command = "node"`, `args = ["${p}"]`].join("\n"),
    notes: "TOML config — appended by hand (or run: codex mcp add).",
  },
  {
    id: "grok",
    name: "Grok CLI",
    configPath: join(home, ".grok", "mcp-config.json"),
    installable: true,
    snippet: mcpServersJson,
  },
  {
    id: "generic",
    name: "Any MCP client (stdio)",
    installable: false,
    snippet: mcpServersJson,
    notes: "Standard MCP stdio server — point your client's server config at this command.",
  },
];

export function findClient(id: string): ClientSpec | undefined {
  return CLIENTS.find((c) => c.id === id);
}

/** Merge our server entry into an existing mcpServers-style JSON config. */
export function mergeMcpConfig(existing: string | undefined, serverPath: string): string {
  let config: Record<string, unknown> = {};
  if (existing?.trim()) {
    config = JSON.parse(existing) as Record<string, unknown>;
  }
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  servers[SERVER_NAME] = serverEntry(serverPath);
  config.mcpServers = servers;
  return JSON.stringify(config, null, 2);
}
