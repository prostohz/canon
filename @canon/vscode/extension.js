'use strict';

const vscode = require('vscode');
const { scan, addressAt, typeAt, PROSE } = require('./canon');

const LABEL = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;
const NAME = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const ADDRESS = new RegExp(
  `^(?:(${NAME}):)?(${NAME})(?:#${NAME})?(?:\\.(${NAME}))?$`
);

const index = new Map(); // module name -> { uri, module }

async function rebuild() {
  index.clear();
  const files = await vscode.workspace.findFiles('**/*.canon', '**/node_modules/**');
  for (const uri of files) {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const module = scan(document.getText());
      if (module.name) index.set(module.name, { uri, module });
    } catch (error) {
      // An unreadable file is no reason to break the index of the rest.
    }
  }
}

function refresh(document) {
  if (document.languageId !== 'canon') return;
  const module = scan(document.getText());
  if (module.name) index.set(module.name, { uri: document.uri, module });
}

function moduleNameOf(document) {
  return scan(document.getText()).name;
}

function declarations(moduleName) {
  const entry = index.get(moduleName);
  return entry ? entry.module.declarations : [];
}

function resolve(target, currentModule) {
  const address = ADDRESS.exec(target);
  if (!address) return null;
  const [, moduleName, name, member] = address;
  const head = moduleName || currentModule;
  const entry = index.get(head);
  if (!entry) return null;
  const node = entry.module.declarations.find((item) => item.name === name);
  if (!node) return null;
  // A member leads to the line of the part or of the value of the enum. An
  // inherited part is not among them: the scan resolves no supertypes, and
  // the declaration itself is the honest answer then.
  const part = member ? node.parts.find((item) => item.name === member) : null;
  return { entry, node, module: head, at: part || node };
}

function targetAt(document, position) {
  const line = document.lineAt(position.line).text;
  const found = addressAt(line, position.character)
    || typeAt(line, position.character);
  if (!found) return null;
  return {
    target: found.target,
    range: new vscode.Range(
      position.line, found.start, position.line, found.end
    ),
  };
}

function inProse(document, position) {
  for (let line = position.line; line >= 0; line -= 1) {
    const text = document.lineAt(line).text;
    if (!text.trim()) continue;
    const head = PROSE.exec(text);
    if (head) return true;
    if (line !== position.line && !/^\s{2,}/.test(text)) return false;
  }
  return false;
}

function describe(node, moduleName) {
  const head = node.kind === 'entity' && node.supertype
    ? `entity ${node.name} : ${node.supertype}`
    : `${node.kind} ${node.name}`;
  const lines = [`_${moduleName}_`, '```canon', head];
  for (const part of node.parts) {
    lines.push(part.type ? `  ${part.name} : ${part.type}` : `  ${part.name}`);
  }
  lines.push('```');
  if (node.means) lines.push(node.means);
  if (node.states) lines.push(node.states);
  return lines.join('\n');
}

function activate(context) {
  rebuild();

  const selector = { language: 'canon' };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(event.document)),
    vscode.workspace.onDidDeleteFiles(rebuild),
    vscode.workspace.onDidCreateFiles(rebuild),

    vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition(document, position) {
        const at = targetAt(document, position);
        if (!at) return null;
        const found = resolve(at.target, moduleNameOf(document));
        if (!found) return null;
        // A link rather than a place, so that the underline lies under the
        // piece of the address that leads there and not under the whole of
        // the reference.
        const column = Math.max(found.at.column, 0);
        const there = new vscode.Range(
          found.at.line, column, found.at.line, column + found.at.name.length
        );
        return [{
          originSelectionRange: at.range,
          targetUri: found.entry.uri,
          targetRange: there,
          targetSelectionRange: there,
        }];
      },
    }),

    vscode.languages.registerHoverProvider(selector, {
      provideHover(document, position) {
        const at = targetAt(document, position);
        if (!at) return null;
        const found = resolve(at.target, moduleNameOf(document));
        if (!found) return null;
        return new vscode.Hover(
          new vscode.MarkdownString(describe(found.node, found.module)), at.range
        );
      },
    }),

    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        provideCompletionItems(document, position) {
          const line = document.lineAt(position.line).text;
          const prose = inProse(document, position);
          const afterColon = /:[ ]*[A-Za-z0-9-]*$/.test(line.slice(0, position.character));
          const afterBracket = /\[[^\]]*$/.test(line.slice(0, position.character));
          if (!prose && !afterColon) return null;
          if (prose && !afterBracket) return null;

          const own = moduleNameOf(document);
          const items = [];
          // Labels are offered nowhere: prose refers to no labels, and a
          // type is not one either.
          for (const [moduleName, entry] of index) {
            for (const node of entry.module.declarations) {
              if (!node.name || LABEL.test(node.name)) continue;
              const label = moduleName === own
                ? node.name
                : `${moduleName}:${node.name}`;
              const item = new vscode.CompletionItem(
                label, vscode.CompletionItemKind.Class);
              item.detail = `${node.kind} · ${moduleName}`;
              if (node.means) item.documentation = new vscode.MarkdownString(node.means);
              items.push(item);
            }
          }
          return items;
        },
      },
      '[',
      ':'
    ),

    vscode.languages.registerDocumentSymbolProvider(selector, {
      provideDocumentSymbols(document) {
        const module = scan(document.getText());
        return module.declarations.map((node) => {
          const range = document.lineAt(node.line).range;
          const kind = ['requirement', 'assume', 'exclude'].includes(node.kind)
            ? vscode.SymbolKind.Event
            : vscode.SymbolKind.Class;
          const symbol = new vscode.DocumentSymbol(
            node.name || node.kind, node.kind, kind, range, range
          );
          symbol.children = node.parts.map((part) => {
            const partRange = document.lineAt(part.line).range;
            return new vscode.DocumentSymbol(
              part.name, part.type, vscode.SymbolKind.Field, partRange, partRange
            );
          });
          return symbol;
        });
      },
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
