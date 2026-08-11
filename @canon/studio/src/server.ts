import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ManifestError, discover, load, resolve } from "@canon/lang";

import { build } from "./model.js";
import type { WorldView } from "./model.js";

// The page is served as it lies, beside the compiled sources: dist/src is
// two levels down from the root of the package.
const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = join(HERE, "..", "..", "public", "index.html");

export const USAGE = `canon-studio — a canon set in a browser

usage:
  canon-studio [paths...] [--port <number>] [--no-browser]

The same set is opened by canon-cli studio, which loads this package.

With no paths named, the set is taken from .canon/canon.toml — the same manifest
canon check reads.
`;

export function snapshot(paths: string[]): WorldView {
  const world = load(paths);
  const diagnostics = [...world.diagnostics, ...resolve(world)];
  return build(world, diagnostics);
}

function open(address: string): void {
  const command = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(command, [address], { stdio: "ignore", detached: true }).unref();
  } catch {
    // Opening a browser is a courtesy: the address is printed anyway.
  }
}

interface Arguments {
  paths: string[];
  port: number;
  browser: boolean;
  help: boolean;
}

export function parseArguments(argv: string[]): Arguments {
  const args: Arguments = { paths: [], port: 8765, browser: true, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-browser") args.browser = false;
    else if (argument === "--port") {
      index += 1;
      args.port = Number(argv[index]);
      if (!Number.isInteger(args.port)) {
        throw new Error(`--port takes a number, not "${argv[index]}"`);
      }
    } else if (argument === "-h" || argument === "--help") args.help = true;
    else if (argument.startsWith("-")) {
      throw new Error(`unknown option: ${argument}`);
    } else args.paths.push(argument);
  }
  return args;
}

export function main(argv: string[]): number {
  let args: Arguments;
  try {
    args = parseArguments(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  let paths: string[];
  try {
    paths = args.paths.length ? args.paths : discover().paths;
  } catch (error) {
    if (!(error instanceof ManifestError)) throw error;
    console.log(error.message);
    return 2;
  }

  const page = readFileSync(INDEX);

  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    if (path.startsWith("/api/world")) {
      const body = Buffer.from(JSON.stringify(snapshot(paths)), "utf8");
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": body.length,
      });
      response.end(body);
      return;
    }
    if (path === "/" || path === "/index.html") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": page.length,
      });
      response.end(page);
      return;
    }
    response.writeHead(404).end();
  });

  const address = `http://127.0.0.1:${args.port}/`;
  server.listen(args.port, "127.0.0.1", () => {
    console.log(`Studio on ${address}  (Ctrl+C to quit)`);
    if (args.browser) open(address);
  });
  return 0;
}
