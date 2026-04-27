// Slice 4 Task 3 -- Handlebars-lite renderer.
// Pure regex {{ key }} substitution. v1 scope skips conditionals, loops,
// helpers, partials. Future Weekly Edge variants that need conditionals
// will be re-versioned templates rather than rendered branches.
//
// Unknown keys leave the placeholder in place and append an entry to the
// `unresolved` array on the result so callers can decide how to handle
// (sendMessage logs them to event_sequence; future strict mode could throw).
//
// Whitespace inside {{ }} is tolerated: {{ name }}, {{name}}, {{  name }} all work.

const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface RenderResult {
  output: string;
  unresolved: string[];
}

export function renderTemplate(
  template: string,
  variables: Record<string, string> = {},
): RenderResult {
  const unresolved: string[] = [];
  const seen = new Set<string>();

  const output = template.replace(TOKEN_RE, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key];
    }
    if (!seen.has(key)) {
      unresolved.push(key);
      seen.add(key);
    }
    return match;
  });

  return { output, unresolved };
}
