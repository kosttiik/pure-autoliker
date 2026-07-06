import { readFileSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "site");
const OUT = join(root, "dist");

const html0 = readFileSync(join(SRC, "index.html"), "utf8");
const css0 = readFileSync(join(SRC, "styles.css"), "utf8");
const js0 = readFileSync(join(SRC, "app.js"), "utf8");

const used = new Set();
function tok() {
  let t;
  do {
    t = String.fromCharCode(97 + ((Math.random() * 26) | 0)) + Math.random().toString(36).slice(2, 6);
  } while (used.has(t));
  used.add(t);
  return t;
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function mapOf(set) { const m = {}; for (const n of set) m[n] = tok(); return m; }
function byLenDesc(set) { return [...set].sort((a, b) => b.length - a.length); }

const classes = new Set(["in", "open", "tag"]);
for (const m of html0.matchAll(/\sclass="([^"]*)"/g)) m[1].trim().split(/\s+/).forEach((c) => c && classes.add(c));

const ids = new Set(["langBtn", "versionStat", "faqList", "tagsCloud"]);
for (const m of html0.matchAll(/\sid="([^"]*)"/g)) ids.add(m[1].trim());
for (const m of html0.matchAll(/href="#([^"]+)"/g)) ids.add(m[1]);

const kfs = new Set();
for (const m of css0.matchAll(/@keyframes\s+([\w-]+)/g)) kfs.add(m[1]);

const vars = new Set();
for (const m of css0.matchAll(/(--[\w-]+)\s*:/g)) vars.add(m[1]);

const i18n = new Set(["doc_title"]);
for (const m of html0.matchAll(/data-i18n="([^"]*)"/g)) i18n.add(m[1]);

const cMap = mapOf(classes), iMap = mapOf(ids), kMap = mapOf(kfs), vMap = mapOf(vars), tMap = mapOf(i18n);

function selector(sel) {
  return sel
    .replace(/\.([\w-]+)/g, (m, c) => (cMap[c] ? "." + cMap[c] : m))
    .replace(/#([\w-]+)/g, (m, c) => (iMap[c] ? "#" + iMap[c] : m));
}

let css = css0;
for (const v of byLenDesc(vars)) css = css.replace(new RegExp(esc(v) + "(?![\\w-])", "g"), vMap[v]);
for (const c of byLenDesc(classes)) css = css.replace(new RegExp("\\." + esc(c) + "(?![\\w-])", "g"), "." + cMap[c]);
for (const id of byLenDesc(ids)) css = css.replace(new RegExp("#" + esc(id) + "(?![\\w-])", "g"), "#" + iMap[id]);
for (const k of byLenDesc(kfs)) css = css.replace(new RegExp("(?<![\\w-])" + esc(k) + "(?![\\w-])", "g"), kMap[k]);
css = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[\t ]*\n[\t ]*/g, "").replace(/ {2,}/g, " ").trim();

let html = html0;
html = html.replace(/(\sclass=")([^"]*)(")/g, (m, a, v, b) => a + v.trim().split(/\s+/).map((c) => cMap[c] || c).join(" ") + b);
html = html.replace(/(\sid=")([^"]*)(")/g, (m, a, v, b) => a + (iMap[v.trim()] || v) + b);
html = html.replace(/(href="#)([^"]+)(")/g, (m, a, v, b) => a + (iMap[v] || v) + b);
html = html.replace(/(data-i18n=")([^"]*)(")/g, (m, a, v, b) => a + (tMap[v] || v) + b);
html = html.replace(/<!--[\s\S]*?-->/g, "");
html = html.replace(/>\n\s*</g, "><").replace(/^[\t ]+/gm, "").replace(/\n{2,}/g, "\n").trim();

let js = js0;
js = js.replace(/(querySelector(?:All)?\(\s*")([^"]*)(")/g, (m, a, s, b) => a + selector(s) + b);
js = js.replace(/(classList\.(?:add|remove|contains|toggle)\(\s*")([^"]*)(")/g, (m, a, c, b) => a + (cMap[c] || c) + b);
js = js.replace(/(className\s*=\s*")([^"]*)(")/g, (m, a, c, b) => a + (cMap[c] || c) + b);
js = js.replace(/(getElementById\(\s*")([^"]*)(")/g, (m, a, id, b) => a + (iMap[id] || id) + b);
for (const k of byLenDesc(i18n)) js = js.replace(new RegExp("\\b" + esc(k) + "\\b", "g"), tMap[k]);
js = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
js = js.replace(/^[\t ]+/gm, "").replace(/\n{2,}/g, "\n").trim();

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, "styles.css"), css);
writeFileSync(join(OUT, "app.js"), js);

console.log("built dist/ | classes", classes.size, "ids", ids.size, "keyframes", kfs.size, "vars", vars.size, "i18n", i18n.size);
