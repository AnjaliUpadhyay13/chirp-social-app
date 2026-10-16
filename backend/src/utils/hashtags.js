// #tags: letters/marks/numbers/underscore (any language, incl. Hindi vowel signs), 1-50 chars,
// not glued to a preceding word character.
const TAG_RE = /(?:^|[^\p{L}\p{M}\p{N}_&])#([\p{L}\p{M}\p{N}_]{1,50})/gu;

export function extractHashtags(text, max = 10) {
  const tags = new Set();
  for (const m of text.matchAll(TAG_RE)) {
    tags.add(m[1].toLowerCase());
    if (tags.size >= max) break;
  }
  return [...tags];
}
