//! Browser Execution Runtime — Rust core (experimental)
//!
//! Hot-path helpers shared with the TypeScript runtime:
//! - short fingerprint hashes
//! - local hashing embeddings + cosine similarity (L3)
//!
//! This is not a full browser engine rewrite. TypeScript remains the default
//! execution kernel; this crate is the start of the deferred Rust core.

pub mod embed;
pub mod fingerprint;

pub use embed::{cosine_similarity, embed_experience, embed_text, DIM};
pub use fingerprint::fingerprint_from_parts;
