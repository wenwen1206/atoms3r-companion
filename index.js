export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
      "Access-Control-Expose-Headers": "mcp-session-id",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. AtomS3R 硬體抓取最新畫面
    if (request.method === "GET" && url.pathname === "/get") {
      const data = await env.DISPLAY_KV.get("current_display");
      if (!data) {
        return new Response(JSON.stringify({ type: "text", content: "(O_O)" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      return new Response(data, {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. 傳統 API 寫入畫面 (/set)
    if (request.method === "POST" && url.pathname === "/set") {
      try {
        const body = await request.json();
        await env.DISPLAY_KV.put("current_display", JSON.stringify(body));
        return new Response("OK", { headers: corsHeaders });
      } catch (err) {
        return new Response("Error parsing JSON", { status: 400, headers: corsHeaders });
      }
    }

    // 3. 網頁版 Claude 專用 MCP 端點 (/mcp)
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      return await handleMCP(request, env, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};

async function handleMCP(request, env, corsHeaders) {
  if (request.method === "GET") {
    return new Response(JSON.stringify({
      name: "atoms3r-display-server",
      version: "1.0.0",
      description: "AtomS3R 掌心螢幕專用 MCP 控制器"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { method, params, id } = body;
      let result;

      switch (method) {
        case "initialize":
          result = {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "atoms3r-display-server", version: "1.0.0" },
            capabilities: { tools: {} }
          };
          break;

        case "tools/list":
          result = {
            tools: [
              {
                name: "draw_on_atoms3r",
                description: "即時繪製或傳送文字到掌心 AtomS3R 螢幕。支援 48x48 滿版像素畫。",
                inputSchema: {
                  type: "object",
                  properties: {
                    display_type: {
                      type: "string",
                      enum: ["text", "pixel"],
                      description: "顯示模式：'text' 為文字/顏文字，'pixel' 為 48x48 滿版點陣畫。"
                    },
                    content: {
                      description: "若 display_type 為 text，請輸入字串；若為 pixel，請輸入 48x48 的二維陣列（裝載十進位 RGB 色碼，如 16711680 代表紅色）。"
                    }
                  },
                  required: ["display_type", "content"]
                }
              }
            ]
          };
          break;

        case "tools/call":
          if (params.name === "draw_on_atoms3r") {
            const { display_type, content } = params.arguments;
            const payload = { type: display_type, content: content };
            await env.DISPLAY_KV.put("current_display", JSON.stringify(payload));
            result = {
              content: [{ type: "text", text: "✓ 已成功畫上 AtomS3R 掌心螢幕！" }]
            };
          } else {
            result = { error: `未知的工具: ${params.name}` };
          }
          break;

        default:
          result = { error: `未知的 RPC 方法: ${method}` };
      }

      return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message }
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
}
