export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/set") {
      try {
        const body = await request.json();
        await env.DISPLAY_KV.put("current_display", JSON.stringify(body));
        return new Response("OK", {
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response("Error parsing JSON", { status: 400 });
      }
    }

    if (request.method === "GET" && url.pathname === "/get") {
      const data = await env.DISPLAY_KV.get("current_display");
      if (!data) {
        return new Response(JSON.stringify({ type: "text", content: "(O_O)" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
      return new Response(data, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
