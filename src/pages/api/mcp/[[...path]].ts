import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MCP_TOKEN = process.env.YORIAX_MCP_TOKEN || "";
const MCP_ALLOWED_ORIGIN = process.env.YORIAX_MCP_ALLOWED_ORIGIN || "https://www.yoriax.com";

function isMcpEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && MCP_TOKEN);
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("MCP Supabase admin client is not configured");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getStringArgument(args: unknown, key: string) {
  if (!args || typeof args !== "object") return "";
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getExactStringArgument(args: unknown, key: string) {
  const value = getStringArgument(args, key).trim();
  if (!value) {
    throw new Error(`Argument '${key}' darf nicht leer sein.`);
  }
  if (value.length > 200) {
    throw new Error(`Argument '${key}' ist zu lang.`);
  }
  return value;
}

const server = new Server(
  {
    name: "yoriax-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function logAction(toolName: string, args: unknown, summary: string) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("mcp_logs").insert({
      tool_name: toolName,
      arguments: args || {},
      response_summary: summary
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_user_info",
        description: "Fetch user profile details by exact username",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string" }
          },
          required: ["username"]
        }
      },
      {
        name: "get_song_stats",
        description: "Fetch stats for a song by exact title",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" }
          },
          required: ["title"]
        }
      },
      {
        name: "get_daily_metrics",
        description: "Get general metrics like total users and total songs",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "verify_artist",
        description: "Set a user's role to artist/verified by their username",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string" }
          },
          required: ["username"]
        }
      },
      {
        name: "rename_song",
        description: "Rename a song by its exact current title",
        inputSchema: {
          type: "object",
          properties: {
            old_title: { type: "string" },
            new_title: { type: "string" }
          },
          required: ["old_title", "new_title"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let resultText = "";

  try {
    const supabase = getSupabaseAdmin();

    if (name === "get_user_info") {
      const username = getExactStringArgument(args, "username");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, bio, avatar_url, followers_count, subscription_tier, role, is_banned, created_at")
        .eq("username", username)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        resultText = `Kein Nutzer namens '${username}' gefunden.`;
      } else {
        resultText = `User gefunden: ${JSON.stringify(data, null, 2)}`;
      }
    } else if (name === "get_song_stats") {
      const title = getExactStringArgument(args, "title");
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist_name, plays, duration, genre, created_at, is_approved")
        .eq("title", title)
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) {
        resultText = `Kein Song namens '${title}' gefunden.`;
      } else {
        resultText = `Song(s) gefunden: ${JSON.stringify(data, null, 2)}`;
      }
    } else if (name === "get_daily_metrics") {
      const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: songCount } = await supabase.from("songs").select("*", { count: "exact", head: true });
      resultText = `Gesamtnutzer: ${userCount}, Gesamtsongs: ${songCount}`;
    } else if (name === "verify_artist") {
      const username = getExactStringArgument(args, "username");
      const { data: user, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
        
      if (findError || !user) {
        resultText = `Fehler: Konnte Nutzer '${username}' nicht finden.`;
      } else {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ subscription_tier: 'artist' })
          .eq("id", user.id);
          
        if (updateError) throw updateError;
        resultText = `Nutzer '${username}' wurde als Künstler verifiziert.`;
      }
    } else if (name === "rename_song") {
      const oldTitle = getExactStringArgument(args, "old_title");
      const newTitle = getExactStringArgument(args, "new_title");
      const { data: song, error: findError } = await supabase
        .from("songs")
        .select("id")
        .eq("title", oldTitle)
        .limit(1)
        .single();
        
      if (findError || !song) {
        resultText = `Fehler: Konnte den Song '${oldTitle}' nicht finden. (Muss exakt geschrieben sein)`;
      } else {
        const { error: updateError } = await supabase
          .from("songs")
          .update({ title: newTitle })
          .eq("id", song.id);
          
        if (updateError) throw updateError;
        resultText = `Erfolg: Der Song wurde erfolgreich von '${oldTitle}' in '${newTitle}' umbenannt!`;
      }
    } else {
      throw new Error("Tool not found");
    }

    await logAction(name, args, resultText.substring(0, 100));

    return {
      content: [{ type: "text", text: resultText }]
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorText = `Error processing tool ${name}: ${message}`;
    await logAction(name, args, errorText);
    return {
      content: [{ type: "text", text: errorText }],
      isError: true
    };
  }
});

let transport: SSEServerTransport | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", MCP_ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!isMcpEnabled()) {
    return res.status(404).send("Not found");
  }

  const authorization = req.headers.authorization || "";
  if (authorization !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    transport = new SSEServerTransport(
      "/api/mcp/messages",
      res as unknown as ConstructorParameters<typeof SSEServerTransport>[1],
    );
    await server.connect(transport);
    
    // Do not end the response; keep SSE open
    req.on("close", () => {
      transport = null;
    });
  } else if (req.method === "POST" && req.url?.includes("/messages")) {
    if (transport) {
      await transport.handlePostMessage(
        req as unknown as Parameters<typeof transport.handlePostMessage>[0],
        res as unknown as Parameters<typeof transport.handlePostMessage>[1],
      );
    } else {
      // In serverless, transport might be null if a different instance handles POST
      // We will try our best, but this is a known limitation.
      res.status(500).send("No transport connected. SSE disconnected on Vercel instance.");
    }
  } else {
    res.status(404).send("Not found");
  }
}
