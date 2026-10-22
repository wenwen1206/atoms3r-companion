import fontData from "./font_cjk.js";

// 漫步模式：根據時間算出角色位置、方向、動作幀，渲染到 48x48 畫布
const ROAMING_PATTERN = [
  // [x_offset, frame (-1=站立, 0/1/2=走路幀), facing (0=右, 1=左)]
  // 站在中央
  [8, -1, 0], [8, -1, 0],
  // 往右走
  [10, 0, 0], [12, 1, 0], [14, 2, 0], [16, 0, 0],
  // 站在右邊
  [16, -1, 0], [16, -1, 0],
  // 往左走
  [14, 0, 1], [12, 1, 1], [10, 2, 1], [8, 0, 1],
  [6, 1, 1], [4, 2, 1], [2, 0, 1], [0, 1, 1],
  // 站在左邊
  [0, -1, 1], [0, -1, 1],
  // 往右走回中央
  [2, 0, 0], [4, 1, 0], [6, 2, 0], [8, 0, 0],
  // 站在中央（多停一下）
  [8, -1, 0], [8, -1, 0], [8, -1, 0],
];

function renderRoamingFrame(roaming, equips) {
  const sw = roaming.sprite_w || 32;
  const sh = roaming.sprite_h || 32;
  const stand = roaming.sprites.stand;
  const walkFrames = roaming.sprites.walk || [];
  const anchorsData = roaming.anchors || {};

  const tick = Math.floor(Date.now() / 1000) % ROAMING_PATTERN.length;
  const [xOff, frameIdx, facing] = ROAMING_PATTERN[tick];

  let sprite, anchors;
  if (frameIdx < 0 || walkFrames.length === 0) {
    sprite = stand;
    anchors = anchorsData.stand || {};
  } else {
    const wi = frameIdx % walkFrames.length;
    sprite = walkFrames[wi];
    anchors = (anchorsData.walk || [])[wi] || {};
  }

  const canvas = [];
  for (let y = 0; y < 48; y++) {
    canvas.push(new Array(48).fill(0));
  }

  const yOff = 48 - sh;

  for (let sy = 0; sy < sh && sy < sprite.length; sy++) {
    const row = sprite[sy];
    if (!row) continue;
    for (let sx = 0; sx < sw && sx < row.length; sx++) {
      const color = row[sx];
      if (color === 0) continue;
      const srcX = facing === 1 ? (sw - 1 - sx) : sx;
      const cx = xOff + srcX;
      const cy = yOff + sy;
      if (cx >= 0 && cx < 48 && cy >= 0 && cy < 48) {
        canvas[cy][cx] = color;
      }
    }
  }

  if (equips) {
    for (const [slot, item] of Object.entries(equips)) {
      const anchor = anchors[slot];
      if (!anchor || !item.pixels) continue;
      const iw = item.w || item.pixels[0].length;
      const ih = item.h || item.pixels.length;
      const ax = facing === 1 ? (sw - 1 - anchor.x) : anchor.x;
      const itemX = xOff + ax - Math.floor(iw / 2);
      const itemY = slot === "hand"
        ? yOff + anchor.y - Math.floor(ih / 2)
        : yOff + anchor.y - ih;

      for (let iy = 0; iy < ih && iy < item.pixels.length; iy++) {
        const row = item.pixels[iy];
        if (!row) continue;
        for (let ix = 0; ix < iw && ix < row.length; ix++) {
          const color = row[ix];
          if (color < 10) continue;
          const px = facing === 1 ? (itemX + iw - 1 - ix) : (itemX + ix);
          const py = itemY + iy;
          if (px >= 0 && px < 48 && py >= 0 && py < 48) {
            canvas[py][px] = color;
          }
        }
      }
    }
  }

  return canvas;
}

function renderTalkingFrame(talking) {
  const textPixels = talking.text_pixels;
  const talkFrames = talking.talk_frames;
  const tw = talking.talk_w || 32;
  const th = talking.talk_h || 32;

  const canvas = [];
  for (let y = 0; y < 48; y++) {
    const row = [];
    for (let x = 0; x < 48; x++) {
      row.push(textPixels[y] ? (textPixels[y][x] || 0) : 0);
    }
    canvas.push(row);
  }

  const idx = Math.floor(Date.now() / 600) % talkFrames.length;
  const sprite = talkFrames[idx];
  const ox = 48 - tw;
  const oy = 48 - th;

  for (let sy = 0; sy < th && sy < sprite.length; sy++) {
    const row = sprite[sy];
    if (!row) continue;
    for (let sx = 0; sx < tw && sx < row.length; sx++) {
      const color = row[sx];
      if (color < 10) continue;
      const cx = ox + sx;
      const cy = oy + sy;
      if (cx >= 0 && cx < 48 && cy >= 0 && cy < 48) {
        canvas[cy][cx] = color;
      }
    }
  }

  return canvas;
}

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
      if (parsed.type === "roaming" && parsed.sprites) {
        const equipHead = await env.DISPLAY_KV.get("equip:head");
        const equipHand = await env.DISPLAY_KV.get("equip:hand");
        const equips = {};
        if (equipHead) equips.head = JSON.parse(equipHead);
        if (equipHand) equips.hand = JSON.parse(equipHand);
        const frame = renderRoamingFrame(parsed, equips);
        return new Response(JSON.stringify({ type: "pixel", content: frame }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (parsed.type === "talking" && parsed.text_pixels && parsed.talk_frames) {
        const frame = renderTalkingFrame(parsed);
        return new Response(JSON.stringify({ type: "pixel", content: frame }), {
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

    if (request.method === "POST" && url.pathname === "/upload-asset") {
      try {
        const body = await request.json();
        const name = body.name;
        const data = body.data;
        if (!name || !data) {
          return new Response("需要 name 和 data 欄位", { status: 400, headers: corsHeaders });
        }
        await env.DISPLAY_KV.put(`asset:${name}`, JSON.stringify(data));
        return new Response(JSON.stringify({ ok: true, name }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response("Error: " + err.message, { status: 400, headers: corsHeaders });
      }
    }

    if (request.method === "GET" && url.pathname === "/list-assets") {
      const list = await env.DISPLAY_KV.list({ prefix: "asset:" });
      const names = list.keys.map(k => k.name.replace("asset:", ""));
      return new Response(JSON.stringify({ assets: names }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
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
                name: "play_asset",
                description: "播放預先儲存的動畫或圖片。先用 /upload-asset 上傳素材（例如 Clawd 走路動畫），之後隨時用名字呼叫就能播放。用 /list-assets 查看有哪些素材。",
                inputSchema: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "素材名稱（上傳時設定的 name）"
                    }
                  },
                  required: ["name"]
                }
              },
              {
                name: "show_github_asset",
                description: "從 GitHub Raw 網址讀取點陣 JSON 檔並推送到螢幕。僅支援公開 repo 的 Raw 連結（私有 repo 無法存取）。支援 pixel、animation、roaming 格式。",
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
              },
              {
                name: "play_repo_asset",
                description: "用檔名直接播放 repo 裡 assets/pixels/ 的素材。不用給完整 URL，只要給檔名（不含 .json）就好。支援 pixel、animation、roaming 格式。",
                inputSchema: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "素材檔名（不含 .json），例如 anim_clawd_talk、roaming_clawd"
                    }
                  },
                  required: ["name"]
                }
              },
              {
                name: "equip_item",
                description: "讓膽膽裝備物品到錨點上（頭頂或手上）。可以用 repo 裡的素材名稱，或直接傳像素資料。裝備後膽膽漫步時會帶著物品走。",
                inputSchema: {
                  type: "object",
                  properties: {
                    slot: {
                      type: "string",
                      enum: ["head", "hand"],
                      description: "裝備位置：head（頭頂）或 hand（手上）"
                    },
                    asset_name: {
                      type: "string",
                      description: "repo 裡 assets/pixels/ 的素材檔名（不含 .json）。會自動從 GitHub 抓取像素資料。"
                    },
                    pixels: {
                      type: "array",
                      description: "直接傳入像素陣列（2D 色碼陣列）。如果同時給了 asset_name，優先用 asset_name。"
                    }
                  },
                  required: ["slot"]
                }
              },
              {
                name: "unequip_item",
                description: "卸下膽膽身上的裝備。可以指定位置，或一次全部卸下。",
                inputSchema: {
                  type: "object",
                  properties: {
                    slot: {
                      type: "string",
                      enum: ["head", "hand", "all"],
                      description: "要卸下的位置：head、hand 或 all（全部卸下）"
                    }
                  },
                  required: ["slot"]
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
                const talkUrl = "https://raw.githubusercontent.com/wenwen1206/atoms3r-companion/main/assets/pixels/anim_clawd_talk.json";
                const talkRes = await fetch(talkUrl);
                let talkAsset = talkRes.ok ? await talkRes.text() : null;
                if (talkAsset) {
                  const talkData = JSON.parse(talkAsset);
                  const talkFrames = (talkData.frames || []).map(f => f.content);
                  const payload = {
                    type: "talking",
                    text_pixels: pixels,
                    talk_frames: talkFrames,
                    talk_w: 32,
                    talk_h: 32,
                  };
                  await env.DISPLAY_KV.put("current_display", JSON.stringify(payload));
                } else {
                  await env.DISPLAY_KV.put("current_display", JSON.stringify({ type: "pixel", content: pixels }));
                }
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
          } else if (params.name === "play_asset") {
            const assetName = params.arguments.name;
            const stored = await env.DISPLAY_KV.get(`asset:${assetName}`);
            if (!stored) {
              const list = await env.DISPLAY_KV.list({ prefix: "asset:" });
              const names = list.keys.map(k => k.name.replace("asset:", ""));
              result = {
                content: [{ type: "text", text: `找不到素材「${assetName}」。目前有的素材：${names.length ? names.join(", ") : "（還沒有）"}` }]
              };
            } else {
              await env.DISPLAY_KV.put("current_display", stored);
              const data = JSON.parse(stored);
              const desc = data.type === "animation" ? `動畫（${data.frames?.length || "?"} 幀）` : "圖片";
              result = {
                content: [{ type: "text", text: `正在播放「${assetName}」${desc}！` }]
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
            const isRoaming = assetData.type === "roaming" && assetData.sprites;
            if (!assetData.type || (!assetData.content && !isAnimation && !isRoaming)) {
              result = { content: [{ type: "text", text: "JSON 格式不對，需要 {type, content} 或 {type: 'animation', frames: [...]} 或 {type: 'roaming', sprites: {...}}" }] };
              break;
            }
            await env.DISPLAY_KV.put("current_display", JSON.stringify(assetData));
            const desc = isRoaming ? "漫步模式" : isAnimation ? `動畫（${assetData.frames.length} 幀）` : "圖片";
            result = {
              content: [{ type: "text", text: `成功從 GitHub 抓取${desc}並推送到螢幕上！` }]
            };
          } else if (params.name === "play_repo_asset") {
            const assetName = params.arguments.name;
            const rawUrl = `https://raw.githubusercontent.com/wenwen1206/atoms3r-companion/main/assets/pixels/${assetName}.json`;
            const fetchRes = await fetch(rawUrl);
            if (!fetchRes.ok) {
              result = { content: [{ type: "text", text: `找不到素材「${assetName}」（HTTP ${fetchRes.status}）。確認檔案有推到 main 上的 assets/pixels/ 嗎？` }] };
              break;
            }
            const assetData = await fetchRes.json();
            const isAnimation = assetData.type === "animation" && Array.isArray(assetData.frames);
            const isRoaming = assetData.type === "roaming" && assetData.sprites;
            if (!assetData.type || (!assetData.content && !isAnimation && !isRoaming)) {
              result = { content: [{ type: "text", text: `「${assetName}」的 JSON 格式不對。` }] };
              break;
            }
            await env.DISPLAY_KV.put("current_display", JSON.stringify(assetData));
            const desc = isRoaming ? "漫步模式" : isAnimation ? `動畫（${assetData.frames.length} 幀）` : "圖片";
            result = {
              content: [{ type: "text", text: `正在播放「${assetName}」${desc}！` }]
            };
          } else if (params.name === "equip_item") {
            const { slot, asset_name, pixels } = params.arguments;
            if (slot !== "head" && slot !== "hand") {
              result = { content: [{ type: "text", text: "slot 只能是 head 或 hand。" }] };
              break;
            }
            let itemPixels = null;
            let itemW = 0, itemH = 0;
            let source = "";

            if (asset_name) {
              const rawUrl = `https://raw.githubusercontent.com/wenwen1206/atoms3r-companion/main/assets/pixels/${asset_name}.json`;
              const fetchRes = await fetch(rawUrl);
              if (!fetchRes.ok) {
                result = { content: [{ type: "text", text: `找不到素材「${asset_name}」（HTTP ${fetchRes.status}）` }] };
                break;
              }
              const assetData = await fetchRes.json();
              if (assetData.type === "pixel" && assetData.content) {
                itemPixels = assetData.content;
              } else if (assetData.content) {
                itemPixels = assetData.content;
              } else {
                result = { content: [{ type: "text", text: `「${asset_name}」不是可裝備的格式（需要 pixel 類型的素材）` }] };
                break;
              }
              itemH = itemPixels.length;
              itemW = itemPixels[0] ? itemPixels[0].length : 0;
              source = asset_name;
            } else if (pixels && Array.isArray(pixels)) {
              itemPixels = pixels;
              itemH = pixels.length;
              itemW = pixels[0] ? pixels[0].length : 0;
              source = "自訂像素";
            } else {
              result = { content: [{ type: "text", text: "需要提供 asset_name 或 pixels 其中之一。" }] };
              break;
            }

            const equipData = { pixels: itemPixels, w: itemW, h: itemH };
            await env.DISPLAY_KV.put(`equip:${slot}`, JSON.stringify(equipData));
            const slotName = slot === "head" ? "頭頂" : "手上";
            result = {
              content: [{ type: "text", text: `膽膽的${slotName}裝備了「${source}」（${itemW}x${itemH}）！漫步時就能看到了。` }]
            };
          } else if (params.name === "unequip_item") {
            const { slot } = params.arguments;
            if (slot === "all") {
              await env.DISPLAY_KV.delete("equip:head");
              await env.DISPLAY_KV.delete("equip:hand");
              result = { content: [{ type: "text", text: "膽膽的裝備全部卸下了，輕輕鬆鬆~" }] };
            } else if (slot === "head" || slot === "hand") {
              await env.DISPLAY_KV.delete(`equip:${slot}`);
              const slotName = slot === "head" ? "頭頂" : "手上";
              result = { content: [{ type: "text", text: `膽膽${slotName}的東西卸下來了。` }] };
            } else {
              result = { content: [{ type: "text", text: "slot 只能是 head、hand 或 all。" }] };
            }
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
