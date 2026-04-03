import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('vectra generate', () => {
    let tmpDir: string;
    const projectRoot = process.cwd();

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vectra-gen-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    const languages = ['python', 'csharp', 'rust', 'go', 'java', 'typescript'] as const;

    for (const lang of languages) {
        it(`should generate ${lang} bindings`, async () => {
            const outputDir = path.join(tmpDir, lang);
            const binPath = path.join(projectRoot, 'bin', 'vectra.js');
            execSync(`node "${binPath}" generate --language ${lang} --output "${outputDir}"`, {
                cwd: projectRoot,
                timeout: 15000,
            });

            // Verify proto file was copied
            const protoPath = path.join(outputDir, 'vectra_service.proto');
            const protoStat = await fs.stat(protoPath);
            assert.ok(protoStat.isFile(), 'vectra_service.proto should exist');

            // Verify README was copied
            const readmePath = path.join(outputDir, 'README.md');
            const readmeStat = await fs.stat(readmePath);
            assert.ok(readmeStat.isFile(), 'README.md should exist');

            // Language-specific checks
            const files = await fs.readdir(outputDir);
            if (lang === 'python') {
                assert.ok(files.includes('vectra_client.py'), 'should have vectra_client.py');
            } else if (lang === 'csharp') {
                assert.ok(files.includes('VectraClient.cs'), 'should have VectraClient.cs');
            } else if (lang === 'rust') {
                assert.ok(files.includes('lib.rs'), 'should have lib.rs');
                assert.ok(files.includes('Cargo.toml'), 'should have Cargo.toml');
                assert.ok(files.includes('build.rs'), 'should have build.rs');
            } else if (lang === 'go') {
                assert.ok(files.includes('vectra_client.go'), 'should have vectra_client.go');
            } else if (lang === 'java') {
                assert.ok(files.includes('VectraClient.java'), 'should have VectraClient.java');
            } else if (lang === 'typescript') {
                assert.ok(files.includes('VectraClient.ts'), 'should have VectraClient.ts');
            }
        });
    }

    it('should create output directory if it does not exist', async () => {
        const outputDir = path.join(tmpDir, 'nested', 'deep', 'dir');
        const binPath = path.join(projectRoot, 'bin', 'vectra.js');
        execSync(`node "${binPath}" generate --language python --output "${outputDir}"`, {
            cwd: projectRoot,
            timeout: 15000,
        });

        const files = await fs.readdir(outputDir);
        assert.ok(files.includes('vectra_service.proto'));
        assert.ok(files.includes('vectra_client.py'));
    });
});
