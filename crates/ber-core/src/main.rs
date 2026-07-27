use ber_core::{cosine_similarity, embed_text, fingerprint_from_parts};
use serde_json::json;
use std::env;

fn main() {
    let mut args = env::args().skip(1).collect::<Vec<_>>();
    if args.is_empty() || args[0] == "--help" || args[0] == "-h" {
        print_help();
        return;
    }
    match args[0].as_str() {
        "fingerprint" => {
            let domain = flag(&args, "--domain").unwrap_or_else(|| "unknown".into());
            let page_hint = flag(&args, "--page-hint").unwrap_or_else(|| "page".into());
            let signals = list_flag(&args, "--signals");
            let buttons = list_flag(&args, "--buttons");
            let dialogs = list_flag(&args, "--dialogs");
            let fp = fingerprint_from_parts(&domain, &page_hint, &signals, &buttons, &dialogs);
            println!("{}", serde_json::to_string_pretty(&json!({ "fingerprint": fp })).unwrap());
        }
        "embed" => {
            let text = args.get(1).cloned().unwrap_or_default();
            let vec = embed_text(&text);
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({ "dim": vec.len(), "vector": vec })).unwrap()
            );
        }
        "similarity" => {
            let a = args.get(1).cloned().unwrap_or_default();
            let b = args.get(2).cloned().unwrap_or_default();
            let score = cosine_similarity(&embed_text(&a), &embed_text(&b));
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({ "cosine": score })).unwrap()
            );
        }
        other => {
            eprintln!("Unknown command: {other}");
            print_help();
            std::process::exit(1);
        }
    }
    let _ = &mut args;
}

fn flag(args: &[String], name: &str) -> Option<String> {
    args.windows(2).find_map(|w| {
        if w[0] == name {
            Some(w[1].clone())
        } else {
            None
        }
    })
}

fn list_flag(args: &[String], name: &str) -> Vec<String> {
    flag(args, name)
        .map(|v| {
            v.split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn print_help() {
    println!(
        "ber-core — Browser Execution Runtime Rust helpers\n\n\
Commands:\n\
  fingerprint --domain HOST [--page-hint HINT] [--signals a,b] [--buttons x] [--dialogs y]\n\
  embed \"text\"\n\
  similarity \"a\" \"b\"\n"
    );
}
