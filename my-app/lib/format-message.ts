export function plainTextFromMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[*\-+]\s+/gm, "")
    .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "$1");
}
