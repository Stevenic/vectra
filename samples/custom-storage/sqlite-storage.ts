/**
 * SQLiteStorage — A custom FileStorage implementation backed by SQLite.
 *
 * See the full tutorial: https://stevenic.github.io/vectra/tutorials/custom-storage
 */
import Database from 'better-sqlite3';
import { FileStorage, FileDetails } from 'vectra';
import { pathUtils } from 'vectra';

function initDatabase(dbPath: string): Database.Database {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      content BLOB NOT NULL,
      is_folder INTEGER NOT NULL DEFAULT 0
    );
  `);

    return db;
}

export class SQLiteStorage implements FileStorage {
    private db: Database.Database;

    constructor(dbPath: string) {
        this.db = initDatabase(dbPath);
    }

    async createFile(filePath: string, content: Buffer | string): Promise<void> {
        const normalized = pathUtils.normalize(filePath);
        const existing = this.db
            .prepare('SELECT 1 FROM files WHERE path = ? AND is_folder = 0')
            .get(normalized);
        if (existing) {
            throw new Error(`File already exists: ${filePath}`);
        }
        const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
        this.db
            .prepare('INSERT INTO files (path, content, is_folder) VALUES (?, ?, 0)')
            .run(normalized, buf);
    }

    async createFolder(folderPath: string): Promise<void> {
        const normalized = pathUtils.normalize(folderPath);
        const parts = normalized.split('/');
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            this.db
                .prepare('INSERT OR IGNORE INTO files (path, content, is_folder) VALUES (?, ?, 1)')
                .run(current, Buffer.alloc(0));
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        const normalized = pathUtils.normalize(filePath);
        this.db
            .prepare('DELETE FROM files WHERE path = ? AND is_folder = 0')
            .run(normalized);
    }

    async deleteFolder(folderPath: string): Promise<void> {
        const normalized = pathUtils.normalize(folderPath);
        this.db
            .prepare('DELETE FROM files WHERE path = ? OR path LIKE ?')
            .run(normalized, `${normalized}/%`);
    }

    async getDetails(fileOrFolderPath: string): Promise<FileDetails> {
        const normalized = pathUtils.normalize(fileOrFolderPath);
        const row = this.db
            .prepare('SELECT path, is_folder FROM files WHERE path = ?')
            .get(normalized) as { path: string; is_folder: number } | undefined;

        if (!row) {
            throw new Error(`Not found: ${fileOrFolderPath}`);
        }

        return {
            name: pathUtils.basename(row.path),
            path: row.path,
            isFolder: row.is_folder === 1,
            fileType:
                row.is_folder === 0
                    ? pathUtils.basename(row.path).split('.').pop()
                    : undefined,
        };
    }

    async listFiles(
        folderPath: string,
        filter?: 'files' | 'folders' | 'all'
    ): Promise<FileDetails[]> {
        const normalized = pathUtils.normalize(folderPath);
        const prefix = normalized ? `${normalized}/` : '';

        const rows = this.db
            .prepare(
                'SELECT path, is_folder FROM files WHERE path LIKE ? AND path NOT LIKE ?'
            )
            .all(`${prefix}%`, `${prefix}%/%`) as Array<{
            path: string;
            is_folder: number;
        }>;

        return rows
            .filter((row) => {
                if (filter === 'files') return row.is_folder === 0;
                if (filter === 'folders') return row.is_folder === 1;
                return true;
            })
            .map((row) => ({
                name: pathUtils.basename(row.path),
                path: row.path,
                isFolder: row.is_folder === 1,
                fileType:
                    row.is_folder === 0
                        ? pathUtils.basename(row.path).split('.').pop()
                        : undefined,
            }));
    }

    async pathExists(fileOrFolderPath: string): Promise<boolean> {
        const normalized = pathUtils.normalize(fileOrFolderPath);
        const row = this.db
            .prepare('SELECT 1 FROM files WHERE path = ?')
            .get(normalized);
        return row !== undefined;
    }

    async readFile(filePath: string): Promise<Buffer> {
        const normalized = pathUtils.normalize(filePath);
        const row = this.db
            .prepare(
                'SELECT content FROM files WHERE path = ? AND is_folder = 0'
            )
            .get(normalized) as { content: Buffer } | undefined;

        if (!row) {
            throw new Error(`File not found: ${filePath}`);
        }
        return Buffer.from(row.content);
    }

    async upsertFile(filePath: string, content: Buffer | string): Promise<void> {
        const normalized = pathUtils.normalize(filePath);
        const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
        this.db
            .prepare(
                'INSERT INTO files (path, content, is_folder) VALUES (?, ?, 0) ON CONFLICT(path) DO UPDATE SET content = excluded.content'
            )
            .run(normalized, buf);
    }

    close(): void {
        this.db.close();
    }
}
