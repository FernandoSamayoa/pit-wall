// Build de producción (lo corre Vercel: ver vercel.json).
//
// index.html se puede abrir tal cual en el navegador porque trae Babel y
// compila su propio JSX. Eso es cómodo para desarrollar pero pesa ~600 KB,
// así que para desplegar este script:
//   1. compila y minifica el <script type="text/babel"> a dist/assets/app.<hash>.js
//   2. escribe dist/index.html sin Babel, apuntando a ese archivo
//   3. copia los archivos estáticos y el service worker (con su versión)
import { transform } from "esbuild";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const OUT = "dist";
const ESTATICOS = ["favicon.svg", "icon-192.png", "icon-512.png", "manifest.json"];
const ABRE = '<script type="text/babel">';
const CIERRA = "</script>";
const BABEL = /^[ \t]*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^"]*"><\/script>\r?\n/m;

const hash = (txt) => createHash("sha256").update(txt).digest("hex").slice(0, 10);

const html = await readFile("index.html", "utf8");
const ini = html.indexOf(ABRE);
const fin = html.indexOf(CIERRA, ini);
if (ini < 0 || fin < 0) throw new Error('index.html: no encuentro el <script type="text/babel">');
if (!BABEL.test(html)) throw new Error("index.html: no encuentro la etiqueta de Babel Standalone");

const { code } = await transform(html.slice(ini + ABRE.length, fin), {
  loader: "jsx",
  minify: true,
  target: "es2020",
  charset: "utf8",
});

const app = `assets/app.${hash(code)}.js`;
const salida = (
  html.slice(0, ini) +
  `<script defer src="/${app}"></script>` +
  html.slice(fin + CIERRA.length)
).replace(BABEL, "");

const sw = (await readFile("sw.js", "utf8"))
  .replace("__BUILD__", hash(salida))
  .replace("__APP__", app);

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/assets`, { recursive: true });
await writeFile(`${OUT}/${app}`, code);
await writeFile(`${OUT}/index.html`, salida);
await writeFile(`${OUT}/sw.js`, sw);
await Promise.all(ESTATICOS.map((f) => copyFile(f, `${OUT}/${f}`)));

const kb = (txt) => `${(Buffer.byteLength(txt) / 1024).toFixed(0)} KB`;
console.log(`dist/index.html ${kb(salida)} · dist/${app} ${kb(code)}`);
