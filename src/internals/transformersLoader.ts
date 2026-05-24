/**
 * Thin wrapper around the dynamic `import('@huggingface/transformers')` call
 * so tests can substitute a mock module without monkey-patching the real
 * module namespace.
 *
 * Why: `@huggingface/transformers` 4.x exports its public symbols as
 * non-configurable, non-writable properties (typical ESM module record
 * behavior), so `sinon.stub(transformersModule, 'pipeline')` errors out with
 * "property descriptor is non-configurable and non-writable". Routing the
 * import through this module gives tests a single injection seam.
 */
type TransformersLibrary = typeof import('@huggingface/transformers');

let loader: () => Promise<TransformersLibrary> = async () => {
    try {
        return await import('@huggingface/transformers');
    } catch {
        throw new Error(
            'TransformersEmbeddings requires @huggingface/transformers. ' +
            'Install it with: npm install @huggingface/transformers'
        );
    }
};

/**
 * Loads `@huggingface/transformers` (or whatever test override is currently
 * installed via `_setTransformersLoader`).
 */
export async function loadTransformers(): Promise<TransformersLibrary> {
    return loader();
}

/**
 * @internal
 * Test seam: replace the loader with a mock. Production code must never call
 * this. Pass `undefined` to restore the default loader.
 */
export function _setTransformersLoader(
    fn: (() => Promise<TransformersLibrary>) | undefined
): void {
    if (fn === undefined) {
        loader = async () => {
            try {
                return await import('@huggingface/transformers');
            } catch {
                throw new Error(
                    'TransformersEmbeddings requires @huggingface/transformers. ' +
                    'Install it with: npm install @huggingface/transformers'
                );
            }
        };
    } else {
        loader = fn;
    }
}
