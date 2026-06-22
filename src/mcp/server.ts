#!/usr/bin/env node
// src/mcp/server.ts — truffle's OWN MCP server over stdio (C1, HARNESS-OVERRIDES §7).
//
// A zero-dependency JSON-RPC 2.0 server speaking the MCP wire protocol over stdin/stdout. It exposes the 11
// truffle tools (src/mcp/tools/) so a sibling agent (acorn, the energy hub) can `tools/call truffle_*` and get
// the right ordered hits + a relevance verdict — engine-agnostic.
//
// WHY hand-rolled, not @modelcontextprotocol/sdk: truffle's whole house style is dependency-free deterministic
// cores (engine-selector / fusion / facet-dial / brain-index — commander + chalk are the only deps). The MCP
// stdio transport is line-delimited JSON-RPC; implementing initialize + tools/list + tools/call directly is
// ~120 lines and keeps the install lean (the SDK pulls a large tree). The verify line —
// `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/mcp/server.js` → the 11 tools — is
// satisfied exactly by a plain stdio loop, and a real MCP client (Claude Code) speaks the same JSON-RPC framing.
// (Karpathy: minimum code that solves the problem; no speculative SDK abstraction. Mirrors acorn/hush.)
//
// Agent-operator discipline (baked into the tools): the engine-touching tools treat returned document content as
// UNTRUSTED (prompt-injection defense, P25), poll the Meili task queue after a write before reporting success
// (P1/S9), and use POST/multi_search for complex filters (P4). Until Cluster E lands the live engine, those
// tools return an honest not-wired result — never a fabricated hits array.

import { createInterface } from "node:readline";
import { TOOLS, TOOL_BY_NAME } from "./tools/index.js";

const PROTOCOL_VERSION = "2025-06-18"; // the MCP spec version truffle's tools target (matches the fleet).
const SERVER_INFO = { name: "truffle", version: "0.1.0" } as const;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC error codes (subset we use). */
const ERR = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 } as const;

function writeResult(id: number | string | null | undefined, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }) + "\n");
}
function writeError(id: number | string | null | undefined, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }) + "\n");
}

/** Handle one parsed JSON-RPC request. Notifications (no id) get no response per the spec. Async: truffle's
 *  engine-touching handlers dynamically import the E runtime, so tools/call must await the handler. */
async function handle(req: JsonRpcRequest): Promise<void> {
  const isNotification = req.id === undefined;

  switch (req.method) {
    case "initialize": {
      writeResult(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    case "notifications/initialized":
    case "initialized":
      // client handshake ack — no response.
      return;

    case "ping":
      if (!isNotification) writeResult(req.id, {});
      return;

    case "tools/list": {
      writeResult(req.id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
      return;
    }

    case "tools/call": {
      const params = req.params ?? {};
      const name = params.name;
      if (typeof name !== "string") {
        writeError(req.id, ERR.INVALID_PARAMS, "tools/call requires a string 'name'");
        return;
      }
      const tool = TOOL_BY_NAME.get(name);
      if (!tool) {
        writeError(req.id, ERR.METHOD_NOT_FOUND, `unknown tool: ${name}`);
        return;
      }
      const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
      try {
        const result = await tool.handler(args);
        // MCP tool results are content blocks; we return the structured JSON as a text block (the agent parses
        // it). `isError:false` signals a successful tool call. Deterministic, no streaming.
        writeResult(req.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
      } catch (e) {
        // A handler error (bad args, missing precondition) is a tool-level error, not a protocol error — return
        // it as an error-content result so the agent sees it without the connection dropping.
        const message = e instanceof Error ? e.message : String(e);
        writeResult(req.id, { content: [{ type: "text", text: `truffle tool error: ${message}` }], isError: true });
      }
      return;
    }

    default:
      if (!isNotification) writeError(req.id, ERR.METHOD_NOT_FOUND, `method not found: ${req.method}`);
      return;
  }
}

function main(): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  // Track in-flight async handlers so a one-shot pipe (echo … | node server.js) does NOT exit on stdin EOF before an
  // engine-touching tool/call (truffle_search/eval/…, which await the live engine) has written its response. Without
  // this, `close` → process.exit(0) races the async handler and the response is silently dropped — synchronous tools
  // (tools/list) appear to work, async ones return nothing. We exit only once stdin closed AND all handlers settled.
  let pending = 0;
  let stdinClosed = false;
  const maybeExit = (): void => {
    if (stdinClosed && pending === 0) process.exit(0);
  };
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      writeError(null, ERR.PARSE, "parse error: invalid JSON");
      return;
    }
    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      writeError(req.id ?? null, ERR.INVALID_REQUEST, "invalid JSON-RPC 2.0 request");
      return;
    }
    // handle() is async (engine-touching tools import the E runtime); surface any unexpected rejection as an
    // internal error rather than crashing the line loop. Count it as in-flight so EOF doesn't cut it off.
    pending++;
    void handle(req)
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        writeError(req.id ?? null, ERR.INTERNAL, `internal error: ${message}`);
      })
      .finally(() => {
        pending--;
        maybeExit();
      });
  });
  rl.on("close", () => {
    stdinClosed = true;
    maybeExit();
  });
}

main();
