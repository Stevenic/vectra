/**
 * Tests for SQLiteStorage — runs against an in-memory database.
 */
import { SQLiteStorage } from './sqlite-storage';

const storage = new SQLiteStorage(':memory:');

// Folders
await storage.createFolder('test/sub');
console.assert(await storage.pathExists('test'), 'folder should exist');
console.assert(await storage.pathExists('test/sub'), 'subfolder should exist');

// Files
await storage.createFile('test/a.json', '{"hello": "world"}');
console.assert(await storage.pathExists('test/a.json'), 'file should exist');

// Read back
const content = await storage.readFile('test/a.json');
console.assert(content.toString() === '{"hello": "world"}', 'content should match');

// Upsert (overwrite)
await storage.upsertFile('test/a.json', '{"hello": "updated"}');
const updated = await storage.readFile('test/a.json');
console.assert(updated.toString() === '{"hello": "updated"}', 'upsert should overwrite');

// createFile should throw on existing file
try {
    await storage.createFile('test/a.json', 'duplicate');
    console.assert(false, 'should have thrown');
} catch {
    // expected
}

// List files
const files = await storage.listFiles('test', 'files');
console.assert(files.length === 1, 'should list one file');
console.assert(files[0].name === 'a.json', 'file name should match');

// Delete
await storage.deleteFile('test/a.json');
console.assert(!(await storage.pathExists('test/a.json')), 'file should be deleted');

// Delete folder recursively
await storage.createFile('test/sub/b.json', 'data');
await storage.deleteFolder('test');
console.assert(!(await storage.pathExists('test')), 'folder should be deleted');
console.assert(!(await storage.pathExists('test/sub/b.json')), 'nested file should be deleted');

console.log('All tests passed.');
