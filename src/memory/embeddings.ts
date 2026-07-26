/**
 * Local hashing embedder (L3).
 * No external model required. Tokens from site/problem/signals/page/goal
 * are hashed into a fixed-size vector for cosine similarity search.
 * Swap later for a real embedding API without changing callers.
 */

const DIM = 128;

export function embedText(text: string, dim = DIM): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    const h = hash32(token);
    const idx = h % dim;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign;
  }
  return l2normalize(vec);
}

export function embedExperience(parts: {
  site: string;
  problem: string;
  pageHint?: string;
  signals?: string[];
  goal?: string;
}): Float32Array {
  return embedText(
    [
      parts.site,
      parts.problem,
      parts.pageHint ?? "",
      ...(parts.signals ?? []),
      parts.goal ?? "",
    ].join(" "),
  );
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function vectorToBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function bufferToVector(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9:_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function l2normalize(vec: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i]! * vec[i]!;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! / norm;
  return vec;
}
