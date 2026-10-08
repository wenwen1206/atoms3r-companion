import fontData from "./font_cjk.js";

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
      const parsed = JSON.parse(data);
      if (parsed.type === "animation" && Array.isArray(parsed.frames) && parsed.frames.length > 0) {
        const interval = parsed.interval || 3;
        const idx = Math.floor(Date.now() / (interval * 1000)) % parsed.frames.length;
        return new Response(JSON.stringify(parsed.frames[idx]), {
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

function hasNonASCII(text) {
  return /[^\x00-\x7F]/.test(text);
}

function parseHexBitmap(hex) {
  const rows = [];
  for (let i = 0; i < 16; i++) {
    rows.push(parseInt(hex.substring(i * 4, i * 4 + 4), 16));
  }
  return rows;
}

async function getGlyphBitmap(ch, env) {
  const customHex = await env.DISPLAY_KV.get(`font:${ch}`);
  if (customHex) return parseHexBitmap(customHex);
  const builtinHex = fontData[ch];
  if (builtinHex) return parseHexBitmap(builtinHex);
  return null;
}

async function renderTextToPixels(text, env, fgColor = 0x00FF00, bgColor = 0x000000) {
  const allChars = [...text];
  const available = [];
  for (const ch of allChars) {
    const bm = await getGlyphBitmap(ch, env);
    if (bm) available.push({ ch, bitmap: bm });
  }
  if (available.length === 0) return null;

  const canvas = Array.from({ length: 48 }, () => new Array(48).fill(bgColor));
  const layouts = computeLayout(available.length);

  for (let ci = 0; ci < available.length && ci < layouts.length; ci++) {
    const { ox, oy, size } = layouts[ci];
    drawGlyph(canvas, available[ci].bitmap, ox, oy, size, fgColor);
  }

  return canvas;
}

function computeLayout(count) {
  if (count === 1) {
    return [{ ox: 0, oy: 0, size: 48 }];
  }
  if (count === 2) {
    return [
      { ox: 0, oy: 12, size: 24 },
      { ox: 24, oy: 12, size: 24 },
    ];
  }
  if (count === 3) {
    return [
      { ox: 0, oy: 16, size: 16 },
      { ox: 16, oy: 16, size: 16 },
      { ox: 32, oy: 16, size: 16 },
    ];
  }
  if (count === 4) {
    return [
      { ox: 0, oy: 0, size: 24 },
      { ox: 24, oy: 0, size: 24 },
      { ox: 0, oy: 24, size: 24 },
      { ox: 24, oy: 24, size: 24 },
    ];
  }
  const positions = [];
  const cols = 3;
  const rows = Math.ceil(Math.min(count, 9) / cols);
  const cellSize = 16;
  const totalW = cols * cellSize;
  const totalH = rows * cellSize;
  const startX = Math.floor((48 - totalW) / 2);
  const startY = Math.floor((48 - totalH) / 2);
  for (let i = 0; i < Math.min(count, 9); i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({ ox: startX + col * cellSize, oy: startY + row * cellSize, size: cellSize });
  }
  return positions;
}

function drawGlyph(canvas, bitmap, ox, oy, size, fgColor) {
  for (let py = 0; py < size; py++) {
    const srcY = Math.floor(py * 16 / size);
    for (let px = 0; px < size; px++) {
      const srcX = Math.floor(px * 16 / size);
      if (bitmap[srcY] & (1 << (15 - srcX))) {
        const cx = ox + px;
        const cy = oy + py;
        if (cx >= 0 && cx < 48 && cy >= 0 && cy < 48) {
          canvas[cy][cx] = fgColor;
        }
      }
    }
  }
}

async function handleMCP(request, env, corsHeaders) {
  if (request.method === "GET") {
    return new Response(JSON.stringify({
      name: "atoms3r-display-server",
      version: "2.1.0",
      description: "AtomS3R 掌心螢幕專用 MCP 控制器（支援中文自動渲染 + 自學新字）"
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
            serverInfo: { name: "atoms3r-display-server", version: "2.1.0" },
            capabilities: { tools: {} }
          };
          break;

        case "tools/list":
          result = {
            tools: [
              {
                name: "draw_on_atoms3r",
                description: "即時繪製到 AtomS3R 掌心螢幕。支援中英文——中文會由伺服器自動渲染成點陣圖，不需要手動轉換。text 模式輸入任意文字即可；pixel 模式接受 48x48 二維色碼陣列。",
                inputSchema: {
                  type: "object",
                  properties: {
                    display_type: {
                      type: "string",
                      enum: ["text", "pixel"],
                      description: "顯示模式：'text' 支援中英文（中文自動轉點陣），'pixel' 為 48x48 自訂點陣畫。"
                    },
                    content: {
                      description: "text 模式輸入任意文字（中英文皆可，建議 1~4 字最清楚）；pixel 模式輸入 48x48 二維陣列，每元素為 24-bit RGB 整數。"
                    },
                    color: {
                      type: "string",
                      description: "文字顏色（僅 text 模式有效），十六進位色碼如 '#FF6600'。預設綠色 '#00FF00'。"
                    }
                  },
                  required: ["display_type", "content"]
                }
              },
              {
                name: "animate_on_atoms3r",
                description: "在 AtomS3R 螢幕上播放動畫。傳入多個文字幀，螢幕會自動輪播（支援中英文，每幀 1~4 字最清楚）。也可傳入 pixel 幀。",
                inputSchema: {
                  type: "object",
                  properties: {
                    frames: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          display_type: { type: "string", enum: ["text", "pixel"] },
                          content: { description: "文字或 48x48 像素陣列" }
                        },
                        required: ["display_type", "content"]
                      },
                      description: "動畫幀陣列（2~8 幀）"
                    },
                    interval: {
                      type: "integer",
                      description: "幀間隔秒數（預設 3，配合 ESP32 的 poll 頻率）"
                    },
                    color: {
                      type: "string",
                      description: "文字幀的顏色，十六進位如 '#FF6600'。預設白色 '#FFFFFF'。"
                    }
                  },
                  required: ["frames"]
                }
              },
              {
                name: "add_character",
                description: "教螢幕認識一個新字元。傳入字元與 16x16 點陣資料（16 個整數，每個代表一行的 16-bit bitmap），之後用 text 模式就能自動顯示這個字。",
                inputSchema: {
                  type: "object",
                  properties: {
                    character: {
                      type: "string",
                      description: "要新增的單一字元"
                    },
                    bitmap: {
                      type: "array",
                      items: { type: "integer" },
                      description: "16 個整數的陣列，每個整數為 0~65535，代表 16x16 點陣圖的一行（bit 15 = 最左邊的像素）。"
                    }
                  },
                  required: ["character", "bitmap"]
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
            const { display_type, content, color } = params.arguments;

            if (display_type === "text" && typeof content === "string" && hasNonASCII(content)) {
              let fgColor = 0x00FF00;
              if (color) {
                const hex = color.replace("#", "");
                fgColor = parseInt(hex, 16);
              }
              const pixels = await renderTextToPixels(content, env, fgColor);
              if (pixels) {
                const payload = { type: "pixel", content: pixels };
                await env.DISPLAY_KV.put("current_display", JSON.stringify(payload));
                result = {
                  content: [{ type: "text", text: `已將「${content}」渲染成點陣圖並推送到螢幕！` }]
                };
              } else {
                result = {
                  content: [{ type: "text", text: `字型中找不到「${content}」的字元，請改用 pixel 模式。` }]
                };
              }
            } else {
              const payload = { type: display_type, content: content };
              await env.DISPLAY_KV.put("current_display", JSON.stringify(payload));
              result = {
                content: [{ type: "text", text: "已成功畫上 AtomS3R 掌心螢幕！" }]
              };
            }
          } else if (params.name === "animate_on_atoms3r") {
            const { frames, interval, color } = params.arguments;
            if (!Array.isArray(frames) || frames.length < 2) {
              result = { content: [{ type: "text", text: "至少需要 2 幀才能做動畫。" }] };
            } else {
              let fgColor = 0xFFFFFF;
              if (color) fgColor = parseInt(color.replace("#", ""), 16);

              const renderedFrames = [];
              for (const frame of frames) {
                if (frame.display_type === "text" && typeof frame.content === "string" && hasNonASCII(frame.content)) {
                  const pixels = await renderTextToPixels(frame.content, env, fgColor);
                  if (pixels) {
                    renderedFrames.push({ type: "pixel", content: pixels });
                  }
                } else {
                  renderedFrames.push({ type: frame.display_type, content: frame.content });
                }
              }

              const payload = {
                type: "animation",
                frames: renderedFrames,
                interval: interval || 3
              };
              await env.DISPLAY_KV.put("current_display", JSON.stringify(payload));
              result = {
                content: [{ type: "text", text: `動畫已推送！共 ${renderedFrames.length} 幀，每 ${interval || 3} 秒切換。` }]
              };
            }
          } else if (params.name === "add_character") {
            const { character, bitmap } = params.arguments;
            if ([...character].length !== 1) {
              result = { content: [{ type: "text", text: "請只傳入一個字元。" }] };
            } else if (!Array.isArray(bitmap) || bitmap.length !== 16) {
              result = { content: [{ type: "text", text: "bitmap 必須是 16 個整數的陣列。" }] };
            } else {
              const hex = bitmap.map(v => (v & 0xFFFF).toString(16).padStart(4, "0")).join("");
              await env.DISPLAY_KV.put(`font:${character}`, hex);
              result = {
                content: [{ type: "text", text: `已學會「${character}」！之後用 text 模式就能顯示了。` }]
              };
            }
          } else if (params.name === "show_github_asset") {
            const fetchRes = await fetch(params.arguments.raw_url);
            if (!fetchRes.ok) {
              result = { content: [{ type: "text", text: `抓取失敗: HTTP ${fetchRes.status}` }] };
              break;
            }
            const assetData = await fetchRes.json();
            const isAnimation = assetData.type === "animation" && Array.isArray(assetData.frames);
            if (!assetData.type || (!assetData.content && !isAnimation)) {
              result = { content: [{ type: "text", text: "JSON 格式不對，需要 {type, content} 或 {type: 'animation', frames: [...]}" }] };
              break;
            }
            await env.DISPLAY_KV.put("current_display", JSON.stringify(assetData));
            const desc = isAnimation ? `動畫（${assetData.frames.length} 幀）` : "圖片";
            result = {
              content: [{ type: "text", text: `成功從 GitHub 抓取${desc}並推送到螢幕上！` }]
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
