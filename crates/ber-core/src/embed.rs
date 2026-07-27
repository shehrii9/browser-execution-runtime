//! Hashing embedder — mirrors TypeScript `src/memory/embeddings.ts`.

pub const DIM: usize = 128;

pub fn embed_text(text: &str) -> Vec<f32> {
    let mut vec = vec![0.0_f32; DIM];
    let tokens = tokenize(text);
    if tokens.is_empty() {
        return vec;
    }
    for token in tokens {
        let h = hash32(&token);
        let idx = (h as usize) % DIM;
        let sign: f32 = if (h & 1) != 0 { 1.0 } else { -1.0 };
        vec[idx] += sign;
    }
    l2_normalize(&mut vec);
    vec
}

pub fn embed_experience(
    site: &str,
    problem: &str,
    page_hint: Option<&str>,
    signals: &[String],
    goal: Option<&str>,
) -> Vec<f32> {
    let mut parts = vec![
        site.to_string(),
        problem.to_string(),
        page_hint.unwrap_or("").to_string(),
    ];
    parts.extend(signals.iter().cloned());
    parts.push(goal.unwrap_or("").to_string());
    embed_text(&parts.join(" "))
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    let mut dot = 0.0_f32;
    let mut na = 0.0_f32;
    let mut nb = 0.0_f32;
    for i in 0..n {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if na == 0.0 || nb == 0.0 {
        return 0.0;
    }
    dot / (na.sqrt() * nb.sqrt())
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric() && c != ':' && c != '_' && c != '-')
        .map(str::trim)
        .filter(|t| t.len() > 1)
        .map(str::to_string)
        .collect()
}

fn hash32(s: &str) -> u32 {
    let mut h: u32 = 2166136261;
    for b in s.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }
    h
}

fn l2_normalize(vec: &mut [f32]) {
    let mut sum = 0.0_f32;
    for v in vec.iter() {
        sum += *v * *v;
    }
    let norm = sum.sqrt();
    if norm == 0.0 {
        return;
    }
    for v in vec.iter_mut() {
        *v /= norm;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn similar_texts_have_high_cosine() {
        let a = embed_text("youtube cookie_banner accept");
        let b = embed_text("youtube cookie_banner accept all");
        let c = embed_text("amazon checkout purchase");
        assert!(cosine_similarity(&a, &b) > cosine_similarity(&a, &c));
    }

    #[test]
    fn empty_embed_is_zero() {
        let v = embed_text("");
        assert_eq!(v.len(), DIM);
        assert!(v.iter().all(|x| *x == 0.0));
    }
}
