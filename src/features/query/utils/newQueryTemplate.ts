const CURSOR_MARKER = "{{cursor}}";

export interface ParsedNewQueryTemplate {
  sql: string;
  cursorOffset: number;
}

/**
 * Removes the optional cursor marker without altering any of the template's
 * remaining whitespace. Offsets are UTF-16 indices, matching Monaco's model API.
 */
export function parseNewQueryTemplate(template: string): ParsedNewQueryTemplate {
  const markerOffset = template.indexOf(CURSOR_MARKER);
  if (markerOffset === -1) {
    return { sql: template, cursorOffset: template.length };
  }

  return {
    sql:
      template.slice(0, markerOffset) +
      template.slice(markerOffset + CURSOR_MARKER.length),
    cursorOffset: markerOffset,
  };
}
