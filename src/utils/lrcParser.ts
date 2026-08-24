export interface LrcLine {
  timeSecs: number;
  text: string;
}

export function parseLrc(lrcText: string): LrcLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of lines) {
    const times: number[] = [];
    let match;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(rawLine)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      times.push(min * 60 + sec + ms / 1000);
    }

    const cleanText = rawLine.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();

    if (cleanText) {
      if (times.length > 0) {
        for (const t of times) {
          result.push({ timeSecs: t, text: cleanText });
        }
      } else {
        result.push({ timeSecs: -1, text: cleanText });
      }
    }
  }

  result.sort((a, b) => a.timeSecs - b.timeSecs);
  return result;
}
