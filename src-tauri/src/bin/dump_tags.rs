use metaflac::Tag;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <file>", args[0]);
        return;
    }
    let path = &args[1];
    if let Ok(tag) = Tag::read_from_path(path) {
        if let Some(c) = tag.vorbis_comments() {
            for (key, values) in &c.comments {
                println!("{}: {} values", key, values.len());
                if let Some(v) = values.first() {
                    let preview = if v.len() > 50 { &v[0..50] } else { v };
                    println!("  [0]: {}...", preview.escape_default());
                }
            }
        } else {
            println!("No vorbis comments.");
        }
    } else {
        println!("Failed to read tag from path");
    }
}
