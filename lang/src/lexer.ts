import { Diagnostic, SpecError } from "./errors.js";

export const KEYWORDS: ReadonlySet<string> = new Set([
  "language", "module", "uses", "means", "entity", "enum", "value",
  "requirement", "assume", "exclude", "states", "because", "obligation",
  "replaces", "given", "many", "optional",
]);

// Words followed by a block of free text rather than by parsed tokens.
export const TEXT_KEYWORDS: ReadonlySet<string> = new Set([
  "means", "states", "because",
]);

const LINE_RE = new RegExp(
  [
    "(?<space> +)",
    "(?<comment>#[^\\n]*)",
    "(?<version>[0-9]+\\.[0-9]+\\.[0-9]+)",
    "(?<qname>[a-z][a-z0-9]*(?:-[a-z0-9]+)*:[a-z][a-z0-9]*(?:-[a-z0-9]+)*)",
    "(?<label>[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)",
    "(?<name>[a-z][a-z0-9]*(?:-[a-z0-9]+)*)",
    "(?<punct>[:,])",
  ].join("|"),
  "y",
);

// The alternatives above, in the order they are tried: the one that matched
// names the kind of the token.
const GROUPS = [
  "space", "comment", "version", "qname", "label", "name", "punct",
] as const;

const DESCRIPTIONS: Record<string, string> = {
  newline: "end of line",
  indent: "start of block",
  dedent: "end of block",
  eof: "end of file",
  text: "text block",
};

export interface Token {
  readonly kind: string;
  readonly value: string;
  readonly line: number;
  readonly column: number;
  readonly indent: number;
}

export function token(
  kind: string, value: string, line: number, column: number, indent = 0,
): Token {
  return { kind, value, line, column, indent };
}

export function describe(item: Token): string {
  return DESCRIPTIONS[item.kind] ?? `"${item.value}"`;
}

function fail(line: number, column: number, message: string): never {
  throw new SpecError(new Diagnostic(line, column, message));
}

function indentOf(line: string, characters = " "): number {
  let width = 0;
  while (width < line.length && characters.includes(line[width])) width += 1;
  return width;
}

export function scanLine(raw: string, line: number): Token[] {
  const tokens: Token[] = [];
  let pos = indentOf(raw);
  while (pos < raw.length) {
    LINE_RE.lastIndex = pos;
    const match = LINE_RE.exec(raw);
    if (match === null) {
      fail(line, pos + 1, `unexpected character '${raw[pos]}'`);
    }
    const groups = match.groups as Record<string, string | undefined>;
    let kind = GROUPS.find((name) => groups[name] !== undefined) as string;
    const value = match[0];
    const column = pos + 1;
    pos = LINE_RE.lastIndex;
    if (kind === "space" || kind === "comment") continue;
    if (kind === "name" && KEYWORDS.has(value)) kind = "kw";
    else if (kind === "punct") kind = value;
    tokens.push(token(kind, value, line, column));
  }
  return tokens;
}

function readText(
  lines: string[], start: number, outer: number, keyword: Token,
): [Token, number] {
  let index = start;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index >= lines.length) {
    fail(keyword.line, keyword.column,
      `indented text is expected after "${keyword.value}"`);
  }
  const base = indentOf(lines[index]);
  if (base <= outer) {
    fail(index + 1, base + 1,
      `text after "${keyword.value}" is written with deeper indentation`);
  }

  const first = index + 1;
  const body: string[] = [];
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      body.push("");
      index += 1;
      continue;
    }
    if (indentOf(line) < base) break;
    body.push(line.slice(base));
    index += 1;
  }
  while (body.length && !body[body.length - 1]) body.pop();
  return [token("text", body.join("\n"), first, base + 1, base), index];
}

export function tokenize(source: string): Token[] {
  const lines = source.split("\n");
  const tokens: Token[] = [];
  const stack = [0];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const stripped = raw.trim();
    if (!stripped || stripped.startsWith("#")) {
      index += 1;
      continue;
    }

    const indent = indentOf(raw, " \t");
    if (raw.slice(0, indent).includes("\t")) {
      fail(index + 1, 1, "indentation is spaces, not a tab");
    }

    const top = stack[stack.length - 1];
    if (indent > top) {
      stack.push(indent);
      tokens.push(token("indent", "", index + 1, indent + 1, indent));
    } else {
      while (indent < stack[stack.length - 1]) {
        stack.pop();
        tokens.push(token("dedent", "", index + 1, indent + 1, indent));
      }
      if (indent !== stack[stack.length - 1]) {
        fail(index + 1, indent + 1, "indentation matches none of the open blocks");
      }
    }

    const lineTokens = scanLine(raw, index + 1);
    tokens.push(...lineTokens);
    tokens.push(token("newline", "", index + 1, raw.length + 1, indent));
    index += 1;

    // A text block is opened only by a word standing alone on its line:
    // otherwise `states : state*` would start prose, not a part of a record.
    const head = lineTokens[0];
    if (lineTokens.length === 1 && head.kind === "kw" && TEXT_KEYWORDS.has(head.value)) {
      const [block, next] = readText(lines, index, indent, head);
      tokens.push(block);
      index = next;
    }
  }

  while (stack.length > 1) {
    stack.pop();
    tokens.push(token("dedent", "", lines.length, 1));
  }
  tokens.push(token("eof", "", lines.length, 1));
  return tokens;
}
