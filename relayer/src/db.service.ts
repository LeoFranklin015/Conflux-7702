import Database from 'better-sqlite3';
import { type Address, type Hex } from 'viem';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StoredAuthorization {
  id: number;
  userAddress: Address;
  contractAddress: Address;
  chainId: number;
  nonce: bigint;
  r: Hex;
  s: Hex;
  yParity: number;
  used: boolean;
  createdAt: number;
  usedAt?: number;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Default to ./data/relayer.db
    const defaultPath = path.join(__dirname, '..', 'data', 'relayer.db');
    this.db = new Database(dbPath || defaultPath);

    console.log(`Database initialized at: ${dbPath || defaultPath}`);

    this.initTables();
  }

  /**
   * Initialize database tables
   */
  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS authorizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userAddress TEXT NOT NULL,
        contractAddress TEXT NOT NULL,
        chainId INTEGER NOT NULL,
        nonce TEXT NOT NULL,
        r TEXT NOT NULL,
        s TEXT NOT NULL,
        yParity INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        usedAt INTEGER,
        UNIQUE(userAddress, contractAddress, chainId)
      )
    `);

    // Create index for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_unused
      ON authorizations(userAddress, used)
    `);

    console.log('Database tables initialized');
  }

  /**
   * Store a new authorization signature
   * Replaces existing authorization if one exists
   */
  storeAuthorization(auth: {
    userAddress: Address;
    contractAddress: Address;
    chainId: number;
    nonce: bigint;
    r: Hex;
    s: Hex;
    yParity: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO authorizations
      (userAddress, contractAddress, chainId, nonce, r, s, yParity, used, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    stmt.run(
      auth.userAddress.toLowerCase(),
      auth.contractAddress.toLowerCase(),
      auth.chainId,
      auth.nonce.toString(),
      auth.r,
      auth.s,
      auth.yParity,
      Date.now()
    );

    console.log(`✅ Stored authorization for user: ${auth.userAddress}`);
  }

  /**
   * Get unused authorization for a user
   */
  getUnusedAuthorization(
    userAddress: Address,
    contractAddress: Address,
    chainId: number
  ): StoredAuthorization | null {
    const stmt = this.db.prepare(`
      SELECT * FROM authorizations
      WHERE userAddress = ?
        AND contractAddress = ?
        AND chainId = ?
        AND used = 0
      LIMIT 1
    `);

    const row = stmt.get(
      userAddress.toLowerCase(),
      contractAddress.toLowerCase(),
      chainId
    ) as any;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userAddress: row.userAddress as Address,
      contractAddress: row.contractAddress as Address,
      chainId: row.chainId,
      nonce: BigInt(row.nonce),
      r: row.r as Hex,
      s: row.s as Hex,
      yParity: row.yParity,
      used: row.used === 1,
      createdAt: row.createdAt,
      usedAt: row.usedAt,
    };
  }

  /**
   * Mark an authorization as used
   */
  markAuthorizationAsUsed(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE authorizations
      SET used = 1, usedAt = ?
      WHERE id = ?
    `);

    stmt.run(Date.now(), id);
    console.log(`✅ Marked authorization ${id} as used`);
  }

  /**
   * Check if user has delegation set up (has used an authorization)
   */
  hasDelegation(
    userAddress: Address,
    contractAddress: Address,
    chainId: number
  ): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM authorizations
      WHERE userAddress = ?
        AND contractAddress = ?
        AND chainId = ?
        AND used = 1
    `);

    const result = stmt.get(
      userAddress.toLowerCase(),
      contractAddress.toLowerCase(),
      chainId
    ) as any;

    return result.count > 0;
  }

  /**
   * Get all authorizations for a user (for debugging)
   */
  getUserAuthorizations(userAddress: Address): StoredAuthorization[] {
    const stmt = this.db.prepare(`
      SELECT * FROM authorizations
      WHERE userAddress = ?
      ORDER BY createdAt DESC
    `);

    const rows = stmt.all(userAddress.toLowerCase()) as any[];

    return rows.map(row => ({
      id: row.id,
      userAddress: row.userAddress as Address,
      contractAddress: row.contractAddress as Address,
      chainId: row.chainId,
      nonce: BigInt(row.nonce),
      r: row.r as Hex,
      s: row.s as Hex,
      yParity: row.yParity,
      used: row.used === 1,
      createdAt: row.createdAt,
      usedAt: row.usedAt,
    }));
  }

  /**
   * Delete old used authorizations (cleanup)
   */
  cleanupOldAuthorizations(olderThanDays: number = 30): number {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(`
      DELETE FROM authorizations
      WHERE used = 1 AND usedAt < ?
    `);

    const result = stmt.run(cutoffTime);
    console.log(`🧹 Cleaned up ${result.changes} old authorizations`);

    return result.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
