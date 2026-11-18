#!/usr/bin/env node
/**
 * Deterministic Expo Tracker marks from the in-app gauge geometry.
 * Dark-mode gauge colors are the OKLCH tokens in src/app/globals.css,
 * converted to sRGB. Tick proportions match InterestGauge:
 *   height H, gap G, thin width (H - G) / 2, attended width H, radius 3.5% of H.
 */
import { execFileSync } from "node:child_process";
import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const chrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const color = {
  bg: "#0A0A0A",
  fg: "#FAFAFA",
  card: "#171717",
  border: "rgba(255,255,255,0.10)",
  lightFg: "#0A0A0A",
  lightBorder: "#E5E5E5",
  manual: "#FFA7D2",
  waiting: "#DEBB19",
  approved: "#5BAE5F",
  done: "#53A3F2",
  amberBorder: "#B45309",
  amberBg: "#451A03",
  amberFg: "#FEF3C7",
  emeraldBorder: "#047857",
  emeraldBg: "#022C22",
  emeraldFg: "#D1FAE5",
};

const ticks = [
  { color: color.manual, kind: "thin" },
  { color: color.waiting, kind: "thin" },
  { color: color.approved, kind: "thin" },
  { color: color.done, kind: "attended" },
];

function tickLayout(height, gap) {
  const thin = (height - gap) / 2;
  const radius = Math.max(1, height * 0.035);
  const widths = ticks.map((tick) => (tick.kind === "attended" ? height : thin));
  const width = widths.reduce((sum, w) => sum + w, 0) + gap * (ticks.length - 1);
  return { height, gap, thin, radius, widths, width };
}

function tickRects(layout, x, y) {
  let cursor = x;
  return ticks.map((tick, index) => {
    const w = layout.widths[index];
    const rect = { x: cursor, y, w, h: layout.height, r: layout.radius, fill: tick.color };
    cursor += w + layout.gap;
    return rect;
  });
}

function svgRect({ x, y, w, h, r, fill, stroke, sw }) {
  const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${sw ?? 1}"` : "";
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" ry="${fmt(r)}" fill="${fill}"${strokeAttr}/>`;
}

function fmt(n) {
  return Number(n.toFixed(3)).toString();
}

function svgDoc(width, height, body, { bg } = {}) {
  const background = bg
    ? `<rect width="${width}" height="${height}" fill="${bg}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
${background}${body}
</svg>
`;
}

function iconSvg({ size, fill, stroke }) {
  const layout = tickLayout(size * 0.21, size * 0.016);
  const groupWidth = layout.width;
  const x = (size - groupWidth) / 2;
  const y = (size - layout.height) / 2;
  const inset = 0.5;
  const radius = size * 0.125;
  const body = [
    svgRect({
      x: inset,
      y: inset,
      w: size - inset * 2,
      h: size - inset * 2,
      r: radius,
      fill,
      stroke,
      sw: 1,
    }),
    ...tickRects(layout, x, y).map(svgRect),
  ].join("\n");
  return svgDoc(size, size, body);
}

function faviconSvg(size) {
  const gap = size / 16;
  const bar = (size * 3.25) / 16;
  const fills = [color.manual, color.waiting, color.approved, color.done];
  const body = fills
    .map((fill, index) =>
      svgRect({ x: index * (bar + gap), y: 0, w: bar, h: size, r: 0, fill }),
    )
    .join("\n");
  return svgDoc(size, size, body);
}

function markSvg() {
  const layout = tickLayout(128, 10);
  const padX = 16;
  const padY = 16;
  return svgDoc(
    layout.width + padX * 2,
    layout.height + padY * 2,
    tickRects(layout, padX, padY).map(svgRect).join("\n"),
  );
}

function write(name, contents) {
  const path = join(here, name);
  writeFileSync(path, contents);
  console.log("wrote", name);
  return path;
}

write("icon.svg", iconSvg({ size: 512, fill: color.card, stroke: color.border }));
write("icon-light.svg", iconSvg({ size: 512, fill: "#FFFFFF", stroke: color.lightBorder }));
writeFileSync(join(here, "../src/app/icon.svg"), faviconSvg(512));
console.log("wrote", "../src/app/icon.svg");
write("mark.svg", markSvg());

const geistPath = globSync(
  join(
    here,
    "../node_modules/.pnpm/next@*/node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  ),
)[0];

if (!geistPath) {
  throw new Error("Could not find Geist woff2 next to next-devtools");
}

const geistData = readFileSync(geistPath).toString("base64");
const fontCss = `@font-face{font-family:Geist;src:url(data:font/woff2;base64,${geistData}) format("woff2");font-weight:100 900;font-style:normal;font-display:block}`;

function tickRowHtml(height) {
  const layout = tickLayout(height, Math.max(1, height * 0.085));
  const rects = tickRects(layout, 0, 0)
    .map(
      (rect) =>
        `<rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.w)}" height="${fmt(rect.h)}" rx="${fmt(rect.r)}" fill="${rect.fill}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(layout.width)}" height="${fmt(layout.height)}" viewBox="0 0 ${fmt(layout.width)} ${fmt(layout.height)}" aria-hidden="true">${rects}</svg>`;
}

const artboards = {
  cover: {
    width: 630,
    height: 500,
    html: `<div class="cover">
  <div class="card">
    ${tickRowHtml(26)}
    <div class="wordmark">expo tracker</div>
    <div class="chips">
      <span class="chip apply">Apply</span>
      <span class="chip starts">Starts</span>
    </div>
  </div>
</div>`,
    css: `html,body{margin:0;width:630px;height:500px;background:${color.bg};}
.cover{width:630px;height:500px;display:flex;align-items:center;justify-content:center;background:${color.bg};}
.card{display:inline-flex;flex-direction:column;align-items:flex-start;background:${color.card};border:1px solid ${color.border};border-radius:18px;box-sizing:border-box;padding:32px 36px 30px;gap:16px;}
.wordmark{font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:36px;font-weight:500;letter-spacing:-0.03em;color:${color.fg};line-height:1;white-space:nowrap;}
.chips{display:flex;gap:8px;margin-top:4px;}
.chip{font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:13px;font-weight:500;letter-spacing:-0.01em;line-height:1;padding:7px 10px;border-radius:4px;border:1px solid;}
.chip.apply{background:${color.amberBg};border-color:${color.amberBorder};color:${color.amberFg};}
.chip.starts{background:${color.emeraldBg};border-color:${color.emeraldBorder};color:${color.emeraldFg};}`,
  },
  wordmark: {
    width: 1200,
    height: 320,
    html: `<div class="row">${tickRowHtml(48)}<div class="wordmark">expo tracker</div></div>`,
    css: `html,body{margin:0;width:1200px;height:320px;background:#FFFFFF;}
.row{width:1200px;height:320px;display:flex;align-items:center;justify-content:center;gap:28px;background:#FFFFFF;}
.wordmark{font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:72px;font-weight:500;letter-spacing:-0.035em;color:${color.lightFg};line-height:1;}`,
  },
  "wordmark-on-dark": {
    width: 1200,
    height: 320,
    html: `<div class="row">${tickRowHtml(48)}<div class="wordmark">expo tracker</div></div>`,
    css: `html,body{margin:0;width:1200px;height:320px;background:${color.bg};}
.row{width:1200px;height:320px;display:flex;align-items:center;justify-content:center;gap:28px;background:${color.bg};}
.wordmark{font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:72px;font-weight:500;letter-spacing:-0.035em;color:${color.fg};line-height:1;}`,
  },
  "wordmark-underline": {
    width: 1200,
    height: 360,
    html: `<div class="page"><div class="stack"><div class="wordmark">expo tracker</div><div class="ticks">${tickRowHtml(22)}</div></div></div>`,
    css: `html,body{margin:0;width:1200px;height:360px;background:#FFFFFF;}
.page{width:1200px;height:360px;display:flex;align-items:center;justify-content:center;background:#FFFFFF;}
.stack{display:flex;flex-direction:column;align-items:stretch;gap:14px;}
.ticks{display:flex;justify-content:flex-end;}
.wordmark{font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:72px;font-weight:500;letter-spacing:-0.035em;color:${color.lightFg};line-height:1;}`,
  },
};

function artboardHtml(art) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${fontCss}${art.css}</style></head>
<body>${art.html}</body></html>`;
}

write(
  "cover.svg",
  svgDoc(
    630,
    500,
    (() => {
      const layout = tickLayout(26, 2);
      const card = { x: 148, y: 150, w: 334, h: 200, r: 18 };
      const ticksX = card.x + 36;
      const ticksY = card.y + 40;
      const rects = tickRects(layout, ticksX, ticksY).map(svgRect).join("\n");
      return [
        svgRect({ x: 0, y: 0, w: 630, h: 500, r: 0, fill: color.bg }),
        svgRect({
          x: card.x + 0.5,
          y: card.y + 0.5,
          w: card.w - 1,
          h: card.h - 1,
          r: card.r,
          fill: color.card,
          stroke: color.border,
          sw: 1,
        }),
        rects,
        `<text x="${ticksX}" y="${ticksY + 54}" fill="${color.fg}" font-family="Geist, ui-sans-serif, system-ui, sans-serif" font-size="36" font-weight="500" letter-spacing="-1.08">expo tracker</text>`,
        svgRect({
          x: ticksX,
          y: ticksY + 78,
          w: 58,
          h: 28,
          r: 4,
          fill: color.amberBg,
          stroke: color.amberBorder,
          sw: 1,
        }),
        `<text x="${ticksX + 10}" y="${ticksY + 97}" fill="${color.amberFg}" font-family="Geist, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="500">Apply</text>`,
        svgRect({
          x: ticksX + 66,
          y: ticksY + 78,
          w: 64,
          h: 28,
          r: 4,
          fill: color.emeraldBg,
          stroke: color.emeraldBorder,
          sw: 1,
        }),
        `<text x="${ticksX + 76}" y="${ticksY + 97}" fill="${color.emeraldFg}" font-family="Geist, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="500">Starts</text>`,
      ].join("\n");
    })(),
  ),
);

const tmp = join(here, ".tmp");
mkdirSync(tmp, { recursive: true });

for (const [name, art] of Object.entries(artboards)) {
  const htmlPath = join(tmp, `${name}.html`);
  writeFileSync(htmlPath, artboardHtml(art));
  const pngPath = join(here, `${name}.png`);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--virtual-time-budget=1000",
      `--window-size=${art.width},${art.height}`,
      "--force-device-scale-factor=2",
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" },
  );
  execFileSync("sips", ["-z", String(art.height), String(art.width), pngPath], {
    stdio: "ignore",
  });
  console.log("wrote", `${name}.png`);
}

function rasterizeSvg(name, { width, height, background = "transparent", svg, pngPath }) {
  const htmlPath = join(tmp, `${name}.html`);
  const markup =
    svg ??
    readFileSync(join(here, `${name}.svg`), "utf8").replace(/^<\?xml[^>]*>\s*/, "");
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><style>html,body{margin:0;width:${width}px;height:${height}px;background:${background}}</style></head><body>${markup.replace(/^<\?xml[^>]*>\s*/, "")}</body></html>`,
  );
  const out = pngPath ?? join(here, `${name}.png`);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--virtual-time-budget=1000",
      `--window-size=${width},${height}`,
      "--force-device-scale-factor=2",
      "--default-background-color=00000000",
      `--screenshot=${out}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" },
  );
  execFileSync("sips", ["-z", String(height), String(width), out], {
    stdio: "ignore",
  });
  if (!pngPath) console.log("wrote", `${name}.png`);
}

rasterizeSvg("icon", { width: 512, height: 512 });
rasterizeSvg("icon-light", { width: 512, height: 512 });
const markLayout = tickLayout(128, 10);
rasterizeSvg("mark", {
  width: Math.round(markLayout.width + 32),
  height: Math.round(markLayout.height + 32),
  background: "#FFFFFF",
});

function pngToIco(pngs) {
  const count = pngs.length;
  let offset = 6 + 16 * count;
  const chunks = [Buffer.alloc(6)];
  chunks[0].writeUInt16LE(1, 2);
  chunks[0].writeUInt16LE(count, 4);
  const payloads = [];
  for (const png of pngs) {
    const entry = Buffer.alloc(16);
    const size = png.size >= 256 ? 0 : png.size;
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.bytes.length, 8);
    entry.writeUInt32LE(offset, 12);
    chunks.push(entry);
    payloads.push(png.bytes);
    offset += png.bytes.length;
  }
  return Buffer.concat([...chunks, ...payloads]);
}

const icoPngs = [16, 32, 48].map((size) => {
  const out = join(tmp, `favicon-${size}.png`);
  rasterizeSvg(`favicon-${size}`, {
    width: size,
    height: size,
    background: "transparent",
    svg: faviconSvg(size),
    pngPath: out,
  });
  return { size, bytes: readFileSync(out) };
});
const faviconPath = join(here, "../src/app/favicon.ico");
writeFileSync(faviconPath, pngToIco(icoPngs));
console.log("wrote", "../src/app/favicon.ico");

rmSync(tmp, { recursive: true, force: true });
