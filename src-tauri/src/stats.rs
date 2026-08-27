use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::{AppHandle, State, Manager};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ListeningEvent {
    pub id: i64,
    pub song_title: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub genre: Option<String>,
    pub duration_ms: i64,
    pub played_at: String, // Stored as string ISO date from SQLite CURRENT_TIMESTAMP
}

pub struct DbState {
    pub db: Mutex<Option<Connection>>,
}

pub fn init_db(app_handle: &AppHandle) {
    let app_data_dir = app_handle.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
    
    let db_path = app_data_dir.join("listening_stats.db");
    let conn = Connection::open(db_path).expect("Failed to open sqlite db");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS listening_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            song_title TEXT NOT NULL,
            artist_name TEXT NOT NULL,
            album_name TEXT,
            genre TEXT,
            duration_ms INTEGER NOT NULL,
            played_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).expect("Failed to create listening_events table");

    app_handle.manage(DbState {
        db: Mutex::new(Some(conn)),
    });
}

#[tauri::command]
pub fn log_listening_event(
    db_state: State<'_, DbState>,
    song_title: String,
    artist_name: String,
    album_name: Option<String>,
    genre: Option<String>,
    duration_ms: i64,
) -> Result<(), String> {
    let lock = db_state.db.lock().map_err(|_| "Failed to acquire db lock")?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    conn.execute(
        "INSERT INTO listening_events (song_title, artist_name, album_name, genre, duration_ms) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![song_title, artist_name, album_name, genre, duration_ms],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn fetch_listening_events(db_state: State<'_, DbState>) -> Result<Vec<ListeningEvent>, String> {
    let lock = db_state.db.lock().map_err(|_| "Failed to acquire db lock")?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    let mut stmt = conn.prepare(
        "SELECT id, song_title, artist_name, album_name, genre, duration_ms, played_at 
         FROM listening_events ORDER BY played_at DESC"
    ).map_err(|e| e.to_string())?;

    let events = stmt.query_map([], |row| {
        Ok(ListeningEvent {
            id: row.get(0)?,
            song_title: row.get(1)?,
            artist_name: row.get(2)?,
            album_name: row.get(3)?,
            genre: row.get(4)?,
            duration_ms: row.get(5)?,
            played_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for event in events {
        match event {
            Ok(e) => result.push(e),
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn delete_listening_history(db_state: State<'_, DbState>) -> Result<(), String> {
    let lock = db_state.db.lock().map_err(|_| "Failed to acquire db lock")?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    conn.execute("DELETE FROM listening_events", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}
