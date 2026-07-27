import { describe, expect, it } from "vitest";
import { embedText, cosineSimilarity } from "../src/memory/embeddings.js";
import { createEmbedderFromEnv, RustHashingEmbedder } from "../src/memory/embedder.js";
import {
  embedTextViaRust,
  rustCoreAvailable,
  rustCoreEnabled,
} from "../src/memory/rustBridge.js";

describe("rust core embeddings bridge", () => {
  it("embedTextViaRust is inert unless BER_RUST_CORE is set", () => {
    const prev = process.env.BER_RUST_CORE;
    delete process.env.BER_RUST_CORE;
    expect(embedTextViaRust("hello")).toBeNull();
    if (prev === undefined) delete process.env.BER_RUST_CORE;
    else process.env.BER_RUST_CORE = prev;
  });

  it.skipIf(!rustCoreAvailable())(
    "ber-core embed matches TypeScript hashing vectors",
    () => {
      const prev = process.env.BER_RUST_CORE;
      process.env.BER_RUST_CORE = "1";
      try {
        const text = "shop.test cookie_banner checkout cookie_banner";
        const ts = embedText(text);
        const rust = embedTextViaRust(text);
        expect(rust).not.toBeNull();
        expect(rust!.length).toBe(ts.length);
        for (let i = 0; i < ts.length; i++) {
          expect(rust![i]).toBeCloseTo(ts[i]!, 5);
        }
        expect(cosineSimilarity(ts, rust!)).toBeCloseTo(1, 5);
      } finally {
        if (prev === undefined) delete process.env.BER_RUST_CORE;
        else process.env.BER_RUST_CORE = prev;
      }
    },
  );

  it.skipIf(!rustCoreAvailable())(
    "createEmbedderFromEnv selects RustHashingEmbedder when enabled",
    () => {
      const prev = process.env.BER_RUST_CORE;
      const prevEmb = process.env.BER_EMBEDDINGS;
      process.env.BER_RUST_CORE = "1";
      process.env.BER_EMBEDDINGS = "hash";
      try {
        const embedder = createEmbedderFromEnv(process.env);
        expect(embedder).toBeInstanceOf(RustHashingEmbedder);
        expect(embedder.id).toBe("local_hashing_rust");
        expect(rustCoreEnabled()).toBe(true);
      } finally {
        if (prev === undefined) delete process.env.BER_RUST_CORE;
        else process.env.BER_RUST_CORE = prev;
        if (prevEmb === undefined) delete process.env.BER_EMBEDDINGS;
        else process.env.BER_EMBEDDINGS = prevEmb;
      }
    },
  );
});
