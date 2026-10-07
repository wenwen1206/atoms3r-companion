export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 發送畫面指令（給 POST /set 或 MCP 工具用）
    if (request.method === "POST" && url.pathname === "/set") {
      try {
        const body = await request.json();
        await env.DISPLAY_KV.put("current_display", JSON.stringify(body));
        return new Response("OK", { headers: corsHeaders });
      } catch (err) {
        return new Response("Error parsing JSON", { status: 400, headers: corsHeaders });
      }
    }

    // 取得最新畫面（給 AtomS3R 硬體拉取用）
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

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
