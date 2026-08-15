/**
 * Minimal, dependency-free parser for the *data* subset of Tcl used by the
 * legacy CrossFire files (card database, decks, combos, reference tables).
 *
 * It intentionally implements only what those files use:
 *   - `set VAR VALUE` commands (VALUE may be brace-quoted, double-quoted, or bare)
 *   - Tcl list splitting with correct brace nesting and backslash handling
 *   - `#` line comments at command position
 *
 * It is NOT a general Tcl interpreter: there is no variable/command
 * substitution, `[...]`, `$var`, or control flow. That is exactly the point —
 * we read static data safely without evaluating anything (Option B).
 */

const WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f', '\v']);

function isWhitespace(ch: string): boolean {
  return WHITESPACE.has(ch);
}

/**
 * Read a brace-quoted group starting at `open` (which must index a `{`).
 * Returns the inner content (one level of braces stripped) and the index
 * immediately after the matching close brace. Nested braces are balanced and
 * backslash-escaped braces do not count toward nesting (Tcl semantics).
 */
function readBraceGroup(s: string, open: number): [content: string, end: number] {
  let depth = 1;
  let i = open + 1;
  const start = i;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return [s.slice(start, i), i + 1];
    }
    i++;
  }
  throw new Error(`Unbalanced '{' starting at index ${open}`);
}

/**
 * Read a double-quoted string starting at `open` (which must index a `"`).
 * Processes basic backslash escapes. Returns the unquoted string and the index
 * after the closing quote.
 */
function readQuoted(s: string, open: number): [content: string, end: number] {
  let i = open + 1;
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      out += s[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') return [out, i + 1];
    out += ch;
    i++;
  }
  throw new Error(`Unterminated '"' starting at index ${open}`);
}

/** Read a bare word (up to the next whitespace or `;`). */
function readBareWord(s: string, start: number): [content: string, end: number] {
  let i = start;
  while (i < s.length && !isWhitespace(s[i] as string) && s[i] !== ';') i++;
  return [s.slice(start, i), i];
}

/**
 * Split a Tcl list string into its elements, stripping exactly one level of
 * quoting from each element. Newlines are treated as ordinary whitespace
 * (list context), and there is no comment handling.
 */
export function splitList(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i] as string;
    if (isWhitespace(ch)) {
      i++;
      continue;
    }
    if (ch === '{') {
      const [content, end] = readBraceGroup(s, i);
      out.push(content);
      i = end;
    } else if (ch === '"') {
      const [content, end] = readQuoted(s, i);
      out.push(content);
      i = end;
    } else {
      const [content, end] = readBareWord(s, i);
      out.push(content);
      i = end;
    }
  }
  return out;
}

export type TclCommand = string[];

/**
 * Parse a Tcl-ish source file into a flat list of commands (each a list of
 * words). Handles `#` comments at command position and `;`/newline command
 * separators. Nested command bodies (e.g. inside `namespace eval NS { ... }`)
 * are captured as a single brace-quoted word — use {@link extractBracedSet}
 * to reach into them by variable name.
 */
export function parseCommands(text: string): TclCommand[] {
  const commands: TclCommand[] = [];
  let current: string[] = [];
  let atCommandStart = true;
  let i = 0;

  const flush = () => {
    if (current.length > 0) commands.push(current);
    current = [];
  };

  while (i < text.length) {
    const ch = text[i] as string;

    if (ch === '\n' || ch === ';') {
      flush();
      atCommandStart = true;
      i++;
      continue;
    }
    if (isWhitespace(ch)) {
      i++;
      continue;
    }
    if (atCommandStart && ch === '#') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }

    atCommandStart = false;
    if (ch === '{') {
      const [content, end] = readBraceGroup(text, i);
      current.push(content);
      i = end;
    } else if (ch === '"') {
      const [content, end] = readQuoted(text, i);
      current.push(content);
      i = end;
    } else {
      const [content, end] = readBareWord(text, i);
      current.push(content);
      i = end;
    }
  }
  flush();
  return commands;
}

/** Build a map of `set VAR VALUE` assignments found anywhere at command level. */
export function parseSetVars(text: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const cmd of parseCommands(text)) {
    if (cmd.length >= 3 && cmd[0] === 'set') {
      vars.set(cmd[1] as string, cmd[2] as string);
    }
  }
  return vars;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the brace-quoted value of `set <varName> { ... }` from anywhere in
 * the text, even when nested inside a `namespace eval` body. Returns the inner
 * content (outer braces stripped), or null if not found.
 */
export function extractBracedSet(text: string, varName: string): string | null {
  const re = new RegExp(`(?:^|[\\s;{])set\\s+${escapeRegExp(varName)}\\s+`, 'm');
  const m = re.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < text.length && isWhitespace(text[i] as string)) i++;
  if (text[i] !== '{') return null;
  const [content] = readBraceGroup(text, i);
  return content;
}
