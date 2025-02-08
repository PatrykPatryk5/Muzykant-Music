const Database = require('better-sqlite3');
const db = new Database('user_preferences.db');

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        language TEXT NOT NULL
    )
`).run();

module.exports = db;