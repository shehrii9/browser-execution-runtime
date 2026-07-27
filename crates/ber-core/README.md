# ber-core (Rust)

Experimental Rust helpers for Browser Execution Runtime.

## What this is

- **Not** a Chromium rewrite
- Small core for fingerprint + hashing embeddings (L3)
- TypeScript remains the default execution kernel

## Build / test

```bash
cargo test -p ber-core
cargo build -p ber-core --release
./target/release/ber-core embed "youtube cookie_banner"
./target/release/ber-core fingerprint --domain youtube.com --page-hint watch --signals media_site,cookie_banner
```

## Bridge

Optional Node bridge: set `BER_RUST_CORE=1` (and ensure `ber-core` is on `PATH`) to prefer the Rust binary for fingerprint hashing experiments.
