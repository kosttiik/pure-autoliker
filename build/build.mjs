import { readFileSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "site");
const OUT = join(root, "dist");

const dropBlank = (s) => s.replace(/\n[ \t]*\n+/g, "\n").trim() + "\n";

let css = readFileSync(join(SRC, "styles.css"), "utf8");
css = dropBlank(css.replace(/\/\*[\s\S]*?\*\//g, ""));

let html = readFileSync(join(SRC, "index.html"), "utf8");
html = dropBlank(html.replace(/<!--[\s\S]*?-->/g, ""));

let js = readFileSync(join(SRC, "app.js"), "utf8");
js = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
js = dropBlank(js);

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
writeFileSync(join(OUT, "styles.css"), css);
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, "app.js"), js);

console.log("built dist/ (comments stripped)");
