/**
 * Reading direction of a piece of text from its first letter: Hebrew (or
 * Arabic) → rtl, anything else → ltr. For free text whose language isn't
 * the interface's, like a chat message typed in English in the Hebrew UI.
 */
export function textDirection(text: string): "rtl" | "ltr" {
  const firstLetter = /[A-Za-z֐-׿؀-ۿ]/.exec(text)?.[0];
  return firstLetter && /[֐-ۿ]/.test(firstLetter) ? "rtl" : "ltr";
}

/**
 * The agent is asked for plain text, but models slip into markdown now and
 * then; chat bubbles show it as plain text, so drop the markup characters.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/`([^`]+)`/g, "$1");
}
