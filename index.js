export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 處理跨域 (CORS) 標頭，方便之後 MCP 或網頁呼叫
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API 1: 給 Claude / MCP 寫入最新顯示資料
    if (request.method === "POST" && url.pathname === "/set") {
      try {
        const data = await request.json();
        
        // 如果沒有指定類型，預設為 text
        if (!data.type) data.type = "text";
        
        // 加上時間戳記，方便 AtomS3R 判斷資料有沒有更新
        data.updated_at = Date.now();

        // 存入 KV 儲存區 (如果沒綁定 KV，可以先暫存記憶體)
        if (env.DISPLAY_KV) {
          await env.DISPLAY_KV.put("current_display", JSON.stringify(data));
        } else {
          // 備用機制：如果暫時沒開 KV，先用 Worker 記憶體暫存
          globalThis.currentData = data;
        }

        return new Response(JSON.stringify({ status: "success", data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: "error", message: err.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // API 2: 給 AtomS3R 抓取當前最新的顯示內容
    if (request.method === "GET" && url.pathname === "/get") {
      let data = null;

      if (env.DISPLAY_KV) {
        const raw = await env.DISPLAY_KV.get("current_display");
        if (raw) data = JSON.parse(raw);
      } else {
        data = globalThis.currentData;
      }

      // 如果還沒有任何資料，預設回傳招牌顏文字
      if (!data) {
        data = {
          type: "text",
          content: "(ʘᗩʘ’)",
          updated_at: Date.now()
        };
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
