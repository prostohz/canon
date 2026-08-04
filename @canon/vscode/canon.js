'use strict';

// Parsing only as far as the editor needs it: declarations, where they are
// and the text of `means`. The checks live in `canon check`; there is no point
// in repeating them here.

const DECLARATION = /^(entity|enum|value)[ ]+([A-Za-z][A-Za-z0-9-]*)(?:[ ]*:[ ]*([A-Za-z][A-Za-z0-9-]*(?::[A-Za-z][A-Za-z0-9-]*)?))?/;
const STATEMENT = /^(requirement|assume|exclude)(?:[ ]+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+))?/;
const MODULE = /^module[ ]+([A-Za-z][A-Za-z0-9-]*)/;
const PART = /^[ ]+([A-Za-z][A-Za-z0-9-]*)[ ]*:[ ]*([A-Za-z][A-Za-z0-9-]*(?::[A-Za-z][A-Za-z0-9-]*)?)/;
const PROSE = /^([ ]*)(means|states|because)[ ]*$/;
const SEGMENT = '[A-Za-z][A-Za-z0-9-]*';
// The address of a reference, up to the bar. The closing bracket is not
// wanted: a caption may break across lines, and the address stands whole on
// the line the reference opens on.
const ADDRESS = new RegExp(
  `(?<!\\\\)\\[(?:(${SEGMENT}):)?(${SEGMENT})(?:#(${SEGMENT}))?(?:\\.(${SEGMENT}))?\\|`,
  'g'
);

function indentOf(line) {
  return line.length - line.replace(/^ +/, '').length;
}

function scan(text) {
  const lines = text.split('\n');
  const module = { name: '', declarations: [], means: '' };
  let current = null;
  let index = 0;

  const prose = (start, outer) => {
    const body = [];
    let base = null;
    let cursor = start;
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (!line.trim()) {
        body.push('');
        cursor += 1;
        continue;
      }
      const indent = indentOf(line);
      if (base === null) {
        if (indent <= outer) break;
        base = indent;
      } else if (indent < base) {
        break;
      }
      body.push(line.slice(base));
      cursor += 1;
    }
    while (body.length && !body[body.length - 1]) body.pop();
    return { text: body.join('\n'), next: cursor, line: start };
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      index += 1;
      continue;
    }

    const proseHead = PROSE.exec(line);
    if (proseHead) {
      const block = prose(index + 1, indentOf(line));
      const target = current || module;
      if (proseHead[2] === 'means') target.means = block.text;
      else target[proseHead[2]] = block.text;
      if (!target.proseLines) target.proseLines = [];
      target.proseLines.push(block.line);
      index = block.next;
      continue;
    }

    if (indentOf(line) === 0) {
      const asModule = MODULE.exec(line);
      if (asModule) {
        module.name = asModule[1];
        current = null;
        index += 1;
        continue;
      }
      const asDeclaration = DECLARATION.exec(line);
      if (asDeclaration) {
        current = {
          kind: asDeclaration[1],
          name: asDeclaration[2],
          supertype: asDeclaration[3] || '',
          line: index,
          column: line.indexOf(asDeclaration[2]),
          parts: [],
          means: '',
        };
        module.declarations.push(current);
        index += 1;
        continue;
      }
      const asStatement = STATEMENT.exec(line);
      if (asStatement) {
        current = {
          kind: asStatement[1],
          name: asStatement[2] || '',
          line: index,
          column: line.indexOf(asStatement[2] || asStatement[1]),
          parts: [],
          means: '',
        };
        module.declarations.push(current);
        index += 1;
        continue;
      }
      current = null;
      index += 1;
      continue;
    }

    const asPart = PART.exec(line);
    if (asPart && current && current.kind === 'entity') {
      current.parts.push({
        name: asPart[1],
        type: asPart[2],
        line: index,
        column: line.indexOf(asPart[1]),
      });
    } else if (current && current.kind === 'enum' && /^[ ]+[A-Za-z]/.test(line)) {
      current.parts.push({ name: trimmed, type: '', line: index, column: indentOf(line) });
    }
    index += 1;
  }

  return module;
}

// Which piece of an address the cursor stands on, and where that piece
// begins and ends. An address holds two things that lead to two places: the
// head — the module and the name — leads to the declaration, the member
// after the dot to the line of the part or of the value of the enum. Between
// them the pieces are told apart by the cursor and by nothing else.
//
// A name given after `#` leads nowhere, and so does the caption: what the
// name stands for is written in the prose above, which is not scanned, and
// the caption is a word of the sentence.
function addressAt(line, character) {
  ADDRESS.lastIndex = 0;
  let match;
  while ((match = ADDRESS.exec(line)) !== null) {
    const [whole, moduleName, name, , member] = match;
    const start = match.index + 1;
    const bar = match.index + whole.length - 1;
    if (character < start || character > bar) continue;
    const head = moduleName ? `${moduleName}:${name}` : name;
    const headEnd = start + head.length;
    if (character <= headEnd) return { target: head, start, end: headEnd };
    if (member && character >= bar - member.length) {
      return { target: `${head}.${member}`, start: bar - member.length, end: bar };
    }
    return null;
  }
  return null;
}

function typeAt(line, character) {
  const part = PART.exec(line);
  if (part) {
    const start = line.indexOf(part[2], line.indexOf(':'));
    if (character >= start && character <= start + part[2].length) {
      return { target: part[2], start, end: start + part[2].length };
    }
  }
  const declaration = DECLARATION.exec(line);
  if (declaration && declaration[3]) {
    const start = line.lastIndexOf(declaration[3]);
    if (character >= start && character <= start + declaration[3].length) {
      return { target: declaration[3], start, end: start + declaration[3].length };
    }
  }
  return null;
}

module.exports = { scan, addressAt, typeAt, indentOf, ADDRESS, PROSE };
