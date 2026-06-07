import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function logAction(toolName: string, args: any, summary: string) {
  try {
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
    if (name === "get_user_info") {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", (args as any).username)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        resultText = `Kein Nutzer namens '${(args as any).username}' gefunden.`;
      } else {
        resultText = `User gefunden: ${JSON.stringify(data[0], null, 2)}`;
      }
    } else if (name === "get_song_stats") {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .ilike("title", (args as any).title);

      if (error) throw error;
      if (!data || data.length === 0) {
        resultText = `Kein Song namens '${(args as any).title}' gefunden.`;
      } else {
        resultText = `Song(s) gefunden: ${JSON.stringify(data, null, 2)}`;
      }
    } else if (name === "get_daily_metrics") {
      const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: songCount } = await supabase.from("songs").select("*", { count: "exact", head: true });
      resultText = `Gesamtnutzer: ${userCount}, Gesamtsongs: ${songCount}`;
    } else if (name === "verify_artist") {
      const { data: user, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", (args as any).username)
        .single();
        
      if (findError || !user) {
        resultText = `Fehler: Konnte Nutzer '${(args as any).username}' nicht finden.`;
      } else {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ subscription_tier: 'artist' })
          .eq("id", user.id);
          
        if (updateError) throw updateError;
        resultText = `Nutzer '${(args as any).username}' wurde als Künstler verifiziert.`;
      }
    } else if (name === "rename_song") {
      const { data: song, error: findError } = await supabase
        .from("songs")
        .select("id")
        .ilike("title", (args as any).old_title)
        .limit(1)
        .single();
        
      if (findError || !song) {
        resultText = `Fehler: Konnte den Song '${(args as any).old_title}' nicht finden. (Muss exakt geschrieben sein)`;
      } else {
        const { error: updateError } = await supabase
          .from("songs")
          .update({ title: (args as any).new_title })
          .eq("id", song.id);
          
        if (updateError) throw updateError;
        resultText = `Erfolg: Der Song wurde erfolgreich von '${(args as any).old_title}' in '${(args as any).new_title}' umbenannt!`;
      }
    } else {
      throw new Error("Tool not found");
    }

    await logAction(name, args, resultText.substring(0, 100));

    return {
      content: [{ type: "text", text: resultText }]
    };
  } catch (error: any) {
    const errorText = `Error processing tool ${name}: ${error.message}`;
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    transport = new SSEServerTransport("/api/mcp/messages", res as any);
    await server.connect(transport);
    
    // Do not end the response; keep SSE open
    req.on("close", () => {
      transport = null;
    });
  } else if (req.method === "POST" && req.url?.includes("/messages")) {
    if (transport) {
      await transport.handlePostMessage(req as any, res as any);
    } else {
      // In serverless, transport might be null if a different instance handles POST
      // We will try our best, but this is a known limitation.
      res.status(500).send("No transport connected. SSE disconnected on Vercel instance.");
    }
  } else {
    res.status(404).send("Not found");
  }
}
