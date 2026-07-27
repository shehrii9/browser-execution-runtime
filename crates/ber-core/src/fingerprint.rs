use sha2::{Digest, Sha256};

/// Stable short fingerprint matching the TS `fingerprintFromParts` shape.
pub fn fingerprint_from_parts(
    domain: &str,
    page_hint: &str,
    signals: &[String],
    buttons: &[String],
    dialogs: &[String],
) -> String {
    let mut signals_n: Vec<String> = signals.iter().map(|s| normalize(s)).collect();
    signals_n.sort();
    let mut dialogs_n: Vec<String> = dialogs
        .iter()
        .map(|d| format!("d:{}", normalize(d)))
        .collect();
    dialogs_n.sort();
    dialogs_n.truncate(8);
    let mut buttons_n: Vec<String> = buttons
        .iter()
        .map(|b| format!("b:{}", normalize(b)))
        .collect();
    buttons_n.sort();
    buttons_n.truncate(12);

    let mut parts: Vec<&str> = Vec::new();
    parts.push(domain);
    parts.push(page_hint);
    let signal_refs: Vec<&str> = signals_n.iter().map(|s| s.as_str()).collect();
    let dialog_refs: Vec<&str> = dialogs_n.iter().map(|s| s.as_str()).collect();
    let button_refs: Vec<&str> = buttons_n.iter().map(|s| s.as_str()).collect();
    parts.extend(signal_refs);
    parts.extend(dialog_refs);
    parts.extend(button_refs);
    let material = parts.join("|");
    let digest = Sha256::digest(material.as_bytes());
    hex::encode(&digest[..8]) // 16 hex chars
}

fn normalize(value: &str) -> String {
    value
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(40)
        .collect()
}

// tiny hex without extra crate dependency issues — use hex crate instead
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        const HEX: &[u8] = b"0123456789abcdef";
        let mut out = String::with_capacity(bytes.len() * 2);
        for b in bytes {
            out.push(HEX[(b >> 4) as usize] as char);
            out.push(HEX[(b & 0xf) as usize] as char);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fingerprint_is_stable_and_order_independent_for_signals() {
        let a = fingerprint_from_parts(
            "example.com",
            "watch",
            &["cookie_banner".into(), "media_site".into()],
            &["Play".into()],
            &[],
        );
        let b = fingerprint_from_parts(
            "example.com",
            "watch",
            &["media_site".into(), "cookie_banner".into()],
            &["Play".into()],
            &[],
        );
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
    }
}
