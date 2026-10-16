// Splits post text into plain and #hashtag segments (same rules as the backend extractor).
const TAG = /(^|[^\p{L}\p{M}\p{N}_&])(#[\p{L}\p{M}\p{N}_]{1,50})/gu;

export function splitHashtags(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) });
    out.push({ type: 'tag', value: m[2] });
    last = start + m[2].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

// Characters as users see them (an emoji counts as 1) - matches the backend limit check.
export const charCount = (text) => Array.from(text).length;
