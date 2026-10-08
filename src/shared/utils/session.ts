export function generateSessionTitle(prompt: string): string {
  const clean = prompt
    .replace(/[\r\n]+/g, ' ')
    .replace(/[，。！？、：；""''“”‘’（）()《》【】]/g, ' ')
    .trim()
  const words = clean.slice(0, 14).trim()
  return words || '新会话'
}
