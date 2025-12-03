// turso-db.js — FIXED & BULLETPROOF

import { connect } from "@tursodatabase/database";

class TursoDB {
  constructor(dbPath = "./my-agent-db.sqlite") {
    this.dbPath = dbPath;
    this.db = null;
    this.ready = this.init(); // ← store the promise!
  }

  async init() {
    this.db = await connect(this.dbPath);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata JSON
      );
      CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
    `);

    console.log(`Turso DB ready: ${this.dbPath}`);
  }

  // ← Add this helper! Wait until DB is ready
  async waitUntilReady() {
    await this.ready;
  }

  async insertMessage({ sessionId, role, content, metadata = {} }) {
    await this.waitUntilReady();           // ← crucial!
    const id = crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    await stmt.run(id, sessionId, role, content, JSON.stringify(metadata));
    return id;
  }

  async getMessages(sessionId, limit = 50) {
    await this.waitUntilReady();
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    return stmt.all(sessionId, limit);
  }

  async updateMessage(id, updates) {
    await this.waitUntilReady();
    const current = await this.getMessageById(id);
    if (!current) return false;

    const stmt = this.db.prepare(`
      UPDATE messages SET content = ?, metadata = ?, timestamp = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    await stmt.run(
      updates.content ?? current.content,
      JSON.stringify({ ...(JSON.parse(current.metadata || "{}")), ...updates.metadata }),
      id
    );
    return true;
  }

  async deleteMessage(idOrSession, isSession = false) {
    await this.waitUntilReady();
    const stmt = isSession
      ? this.db.prepare("DELETE FROM messages WHERE session_id = ?")
      : this.db.prepare("DELETE FROM messages WHERE id = ?");
    await stmt.run(idOrSession);
    return this.db.changes;
  }

  async getMessageById(id) {
    await this.waitUntilReady();
    const stmt = this.db.prepare("SELECT * FROM messages WHERE id = ?");
    return stmt.get(id);
  }

  async close() {
    await this.waitUntilReady();
    if (this.db) this.db.close();
  }
}

// ==================== USAGE (NOW WORKS!) ====================
(async () => {
  const db = new TursoDB("./my-agent-db.sqlite");

  // ← Wait for DB to be fully initialized
  await db.waitUntilReady();

  await db.insertMessage({
    sessionId: "chat-123",
    role: "user",
    content: "Hello, what's the weather?",
  });

  await db.insertMessage({
    sessionId: "chat-123",
    role: "assistant",
    content: "It's sunny today!",
    metadata: { tools: ["weather_api"] },
  });

  const history = await db.getMessages("chat-123");
  console.log("Chat history:", history);

  await db.close();
})();