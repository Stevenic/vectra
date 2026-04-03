import { pathUtils as path } from '../utils/pathUtils';
import { FileStorage, LocalFileStorage } from '../storage';
import { IndexCodec } from './IndexCodec';
import { JsonCodec } from './JsonCodec';
import { ProtobufCodec } from './ProtobufCodec';

export type FormatName = 'json' | 'protobuf';

function codecForFormat(format: FormatName): IndexCodec {
    return format === 'protobuf' ? new ProtobufCodec() : new JsonCodec();
}

/**
 * Detects the codec in use for an existing index folder.
 * @remarks
 * Checks for `index.json` and `index.pb` files. If both exist, throws an
 * error directing the user to re-run migration. If neither exists, throws.
 * @param folderPath Path to the index folder.
 * @param storage Storage backend to use.
 * @returns The detected codec.
 */
export async function detectCodec(folderPath: string, storage: FileStorage): Promise<IndexCodec> {
    const hasJson = await storage.pathExists(path.join(folderPath, 'index.json'));
    const hasPb = await storage.pathExists(path.join(folderPath, 'index.pb'));

    if (hasJson && hasPb) {
        throw new Error(
            'Both index.json and index.pb found — the index may be in a partially migrated state. ' +
            'Run `vectra migrate` or `migrateIndex()` to complete the migration.'
        );
    }
    if (hasPb) return new ProtobufCodec();
    if (hasJson) return new JsonCodec();
    throw new Error('No index file found (expected index.json or index.pb).');
}

export interface MigrateOptions {
    to: FormatName;
    storage?: FileStorage;
}

/**
 * Migrates an index folder from one serialization format to another.
 * @param folderPath Path to the index folder.
 * @param options Migration options.
 */
export async function migrateIndex(folderPath: string, options: MigrateOptions): Promise<void> {
    const storage = options.storage || new LocalFileStorage();
    const targetCodec = codecForFormat(options.to);

    // Detect current format
    const sourceCodec = await detectCodec(folderPath, storage);

    if (sourceCodec.extension === targetCodec.extension) {
        return; // Already in target format
    }

    // --- Migrate index file ---
    const sourceIndexPath = path.join(folderPath, `index${sourceCodec.extension}`);
    const targetIndexPath = path.join(folderPath, `index${targetCodec.extension}`);
    const indexBuffer = await storage.readFile(sourceIndexPath);
    const indexData = sourceCodec.deserializeIndex(indexBuffer);

    // Rewrite external metadata file references
    for (const item of indexData.items) {
        if (item.metadataFile && item.metadataFile.endsWith(sourceCodec.extension)) {
            const baseName = item.metadataFile.slice(0, -sourceCodec.extension.length);
            const oldMetaPath = path.join(folderPath, item.metadataFile);
            const newMetaFile = `${baseName}${targetCodec.extension}`;
            const newMetaPath = path.join(folderPath, newMetaFile);

            // Read, re-serialize, write
            const metaBuf = await storage.readFile(oldMetaPath);
            const metadata = sourceCodec.deserializeMetadata(metaBuf);
            await storage.upsertFile(newMetaPath, targetCodec.serializeMetadata(metadata));

            // Update reference
            item.metadataFile = newMetaFile;
        }
    }

    // Write new index
    await storage.upsertFile(targetIndexPath, targetCodec.serializeIndex(indexData));

    // --- Migrate catalog if present ---
    const sourceCatalogPath = path.join(folderPath, `catalog${sourceCodec.extension}`);
    const targetCatalogPath = path.join(folderPath, `catalog${targetCodec.extension}`);
    if (await storage.pathExists(sourceCatalogPath)) {
        const catalogBuffer = await storage.readFile(sourceCatalogPath);
        const catalog = sourceCodec.deserializeCatalog(catalogBuffer);

        // Migrate per-document metadata files
        for (const docId of Object.values(catalog.idToUri ? catalog.idToUri : {})) {
            // Document metadata uses documentId as filename base
        }
        // Actually the document IDs are the keys of idToUri
        for (const docId of Object.keys(catalog.idToUri)) {
            const oldDocMetaPath = path.join(folderPath, `${docId}${sourceCodec.extension}`);
            if (await storage.pathExists(oldDocMetaPath)) {
                const docMetaBuf = await storage.readFile(oldDocMetaPath);
                const docMeta = sourceCodec.deserializeMetadata(docMetaBuf);
                const newDocMetaPath = path.join(folderPath, `${docId}${targetCodec.extension}`);
                await storage.upsertFile(newDocMetaPath, targetCodec.serializeMetadata(docMeta));
                await storage.deleteFile(oldDocMetaPath);
            }
        }

        await storage.upsertFile(targetCatalogPath, targetCodec.serializeCatalog(catalog));
        await storage.deleteFile(sourceCatalogPath);
    }

    // --- Clean up old files (after new files are safely written) ---
    // Delete old external metadata files
    for (const item of sourceCodec.deserializeIndex(indexBuffer).items) {
        if (item.metadataFile) {
            const oldMetaPath = path.join(folderPath, item.metadataFile);
            if (await storage.pathExists(oldMetaPath)) {
                await storage.deleteFile(oldMetaPath);
            }
        }
    }

    // Delete old index file last
    await storage.deleteFile(sourceIndexPath);
}
