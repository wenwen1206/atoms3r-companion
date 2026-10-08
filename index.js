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

    if (request.method === "POST" && url.pathname === "/set") {
      try {
        const body = await request.json();
        await env.DISPLAY_KV.put("current_display", JSON.stringify(body));
        return new Response("OK", { headers: corsHeaders });
      } catch (err) {
        return new Response("Error parsing JSON", { status: 400, headers: corsHeaders });
      }
    }

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
      version: "1.1.0",
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
            serverInfo: { name: "atoms3r-display-server", version: "1.1.0" },
            capabilities: { tools: {} }
          };
          break;

        case "tools/list":
          result = {
            tools: [
              {
                name: "draw_on_atoms3r",
                description: "即時繪製到 AtomS3R 螢幕。text 模式僅支援英文/ASCII/顏文字，中文或特殊符號必須先轉成 48x48 像素陣列再用 pixel 模式推送。",
                inputSchema: {
                  type: "object",
                  properties: {
                    display_type: {
                      type: "string",
                      enum: ["text", "pixel"],
                      description: "顯示模式：'text' 僅限英文與 ASCII 顏文字，'pixel' 為 48x48 點陣畫（中文必須用此模式）。"
                    },
                    content: {
                      description: "text 模式請輸入英文字串；pixel 模式請輸入 48x48 二維陣列，每個元素為 24-bit RGB 色碼整數（如 16711680 = 紅色 0xFF0000）。"
                    }
                  },
                  required: ["display_type", "content"]
                }
              },
              {
                name: "show_github_asset",
                description: "從 GitHub Raw 網址讀取點陣 JSON 檔並推送到螢幕。僅支援公開 repo 的 Raw 連結（私有 repo 無法存取）。JSON 格式須為 {type: 'pixel', content: 48x48 二維色碼陣列}。",
                inputSchema: {
                  type: "object",
                  properties: {
                    raw_url: {
                      type: "string",
                      description: "GitHub 上 JSON 檔案的 Raw 網址"
                    }
                  },
                  required: ["raw_url"]
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
              content: [{ type: "text", text: "已成功畫上 AtomS3R 掌心螢幕！" }]
            };
          } else if (params.name === "show_github_asset") {
            const fetchRes = await fetch(params.arguments.raw_url);
            if (!fetchRes.ok) {
              result = { content: [{ type: "text", text: `抓取失敗: HTTP ${fetchRes.status}` }] };
              break;
            }
            const assetData = await fetchRes.json();
            if (!assetData.type || !assetData.content) {
              result = { content: [{ type: "text", text: "JSON 格式不對，需要 {type, content}" }] };
              break;
            }
            await env.DISPLAY_KV.put("current_display", JSON.stringify(assetData));
            result = {
              content: [{ type: "text", text: "成功從 GitHub 抓取檔案並推送到螢幕上！" }]
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
