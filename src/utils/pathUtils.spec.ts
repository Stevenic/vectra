import * as assert from 'assert';
import { pathUtils } from './pathUtils';

describe('pathUtils', () => {
    describe('sep', () => {
        it('should be forward slash', () => {
            assert.strictEqual(pathUtils.sep, '/');
        });
    });

    describe('join', () => {
        it('should join simple segments', () => {
            assert.strictEqual(pathUtils.join('a', 'b', 'c'), 'a/b/c');
        });

        it('should strip trailing slashes from first segment', () => {
            assert.strictEqual(pathUtils.join('a/', 'b'), 'a/b');
        });

        it('should strip leading and trailing slashes from middle segments', () => {
            assert.strictEqual(pathUtils.join('a', '/b/', 'c'), 'a/b/c');
        });

        it('should handle backslashes', () => {
            assert.strictEqual(pathUtils.join('a\\', '\\b\\', 'c'), 'a/b/c');
        });

        it('should filter empty segments', () => {
            assert.strictEqual(pathUtils.join('a', '', 'b'), 'a/b');
        });
    });

    describe('basename', () => {
        it('should return last segment with forward slashes', () => {
            assert.strictEqual(pathUtils.basename('a/b/file.txt'), 'file.txt');
        });

        it('should return last segment with backslashes', () => {
            assert.strictEqual(pathUtils.basename('a\\b\\file.txt'), 'file.txt');
        });

        it('should strip extension when provided', () => {
            assert.strictEqual(pathUtils.basename('a/b/file.txt', '.txt'), 'file');
        });

        it('should not strip mismatched extension', () => {
            assert.strictEqual(pathUtils.basename('a/b/file.txt', '.md'), 'file.txt');
        });

        it('should handle path with no directory', () => {
            assert.strictEqual(pathUtils.basename('file.txt'), 'file.txt');
        });
    });

    describe('dirname', () => {
        it('should return directory with forward slashes', () => {
            assert.strictEqual(pathUtils.dirname('a/b/file.txt'), 'a/b');
        });

        it('should return directory with backslashes', () => {
            assert.strictEqual(pathUtils.dirname('a\\b\\file.txt'), 'a/b');
        });

        it('should return . for file with no directory', () => {
            assert.strictEqual(pathUtils.dirname('file.txt'), '.');
        });
    });

    describe('extname', () => {
        it('should return extension', () => {
            assert.strictEqual(pathUtils.extname('file.txt'), '.txt');
        });

        it('should return last extension for double extensions', () => {
            assert.strictEqual(pathUtils.extname('file.spec.ts'), '.ts');
        });

        it('should return empty string for no extension', () => {
            assert.strictEqual(pathUtils.extname('Makefile'), '');
        });

        it('should return empty string for dotfile', () => {
            assert.strictEqual(pathUtils.extname('.gitignore'), '');
        });
    });

    describe('normalize', () => {
        it('should resolve .. segments', () => {
            assert.strictEqual(pathUtils.normalize('a/b/../c'), 'a/c');
        });

        it('should resolve . segments', () => {
            assert.strictEqual(pathUtils.normalize('a/./b'), 'a/b');
        });

        it('should handle absolute paths', () => {
            assert.strictEqual(pathUtils.normalize('/a/b/../c'), '/a/c');
        });

        it('should handle Windows drive paths', () => {
            assert.strictEqual(pathUtils.normalize('C:\\a\\b\\..\\c'), 'C:/a/c');
        });

        it('should collapse multiple separators', () => {
            assert.strictEqual(pathUtils.normalize('a//b///c'), 'a/b/c');
        });
    });

    describe('isAbsolute', () => {
        it('should detect Unix absolute path', () => {
            assert.strictEqual(pathUtils.isAbsolute('/usr/bin'), true);
        });

        it('should detect Windows absolute path', () => {
            assert.strictEqual(pathUtils.isAbsolute('C:\\Users'), true);
        });

        it('should detect Windows path with forward slash', () => {
            assert.strictEqual(pathUtils.isAbsolute('C:/Users'), true);
        });

        it('should return false for relative path', () => {
            assert.strictEqual(pathUtils.isAbsolute('src/index.ts'), false);
        });
    });

    describe('relative', () => {
        it('should compute relative path between directories', () => {
            assert.strictEqual(pathUtils.relative('a/b', 'a/c'), '../c');
        });

        it('should compute relative path going up multiple levels', () => {
            assert.strictEqual(pathUtils.relative('a/b/c', 'a/d/e'), '../../d/e');
        });

        it('should return . for same path', () => {
            assert.strictEqual(pathUtils.relative('a/b', 'a/b'), '.');
        });

        it('should handle going deeper', () => {
            assert.strictEqual(pathUtils.relative('a', 'a/b/c'), 'b/c');
        });

        it('should handle completely different paths', () => {
            assert.strictEqual(pathUtils.relative('x/y', 'a/b'), '../../a/b');
        });
    });
});
