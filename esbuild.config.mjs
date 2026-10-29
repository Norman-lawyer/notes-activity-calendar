import { build } from "esbuild";
import { readFile } from "node:fs/promises";
const pluginLicense = await readFile("LICENSE", "utf8");
const lunarLicense = await readFile("LUNAR-LICENSE", "utf8");
await build({ entryPoints: ["src/main.ts"], bundle: true, platform: "browser", format: "cjs", target: "es2020", external: ["obsidian"], outfile: "main.js", sourcemap: false, legalComments: "eof", banner: { js: `/*! Notes Activity Calendar license:\n${pluginLicense}\n*/\n/*! lunar-javascript license:\n${lunarLicense}\n*/` } });
