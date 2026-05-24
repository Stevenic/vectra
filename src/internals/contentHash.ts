import { createHash } from 'crypto';
import { MetadataTypes } from '../types';

/**
 * Canonical JSON encoding of a metadata object: keys sorted ascending, no
 * whitespace. Values are restricted to MetadataTypes (string | number | boolean),
 * so JSON.stringify is sufficient — there are no nested objects to recurse into.
 */
function canonicalMetadata(metadata?: Record<string, MetadataTypes>): string {
    const obj = metadata ?? {};
    const keys = Object.keys(obj).sort();
    const pairs: string[] = [];
    for (const k of keys) {
        pairs.push(`${JSON.stringify(k)}:${JSON.stringify(obj[k])}`);
    }
    return `{${pairs.join(',')}}`;
}

/**
 * Computes a stable SHA-256 hash over the inputs that determine the stored
 * chunks and vectors for a document: text body, docType, and metadata. Used by
 * `LocalDocumentIndex.upsertDocument` to short-circuit when content is
 * unchanged.
 *
 * `metadata: undefined` and `metadata: {}` hash identically (both canonicalize
 * to `{}`).
 *
 * @returns 64-character lowercase hex string.
 */
export function computeContentHash(
    text: string,
    docType?: string,
    metadata?: Record<string, MetadataTypes>,
): string {
    const hash = createHash('sha256');
    hash.update(text);
    hash.update('\0');
    hash.update(docType ?? '');
    hash.update('\0');
    hash.update(canonicalMetadata(metadata));
    return hash.digest('hex');
}
