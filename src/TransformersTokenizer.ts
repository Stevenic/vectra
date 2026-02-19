import { PreTrainedTokenizer } from "@huggingface/transformers";
import { Tokenizer } from "./types";

/**
 * A tokenizer wrapper for Transformers.js models.
 * @remarks
 * This tokenizer uses the same tokenizer as the embedding model,
 * ensuring consistency between text splitting and embedding generation.
 *
 * Obtain an instance via TransformersEmbeddings.getTokenizer().
 */
export class TransformersTokenizer implements Tokenizer {
    private readonly _tokenizer: PreTrainedTokenizer;

    /**
     * Creates a new TransformersTokenizer.
     * @param tokenizer The underlying Transformers.js tokenizer.
     * @remarks
     * Typically created via TransformersEmbeddings.getTokenizer().
     */
    public constructor(tokenizer: PreTrainedTokenizer) {
        this._tokenizer = tokenizer;
    }

    /**
     * Encodes text into token IDs.
     * @param text The text to encode.
     * @returns Array of token IDs.
     */
    public encode(text: string): number[] {
        const encoded = this._tokenizer(text);
        // Transformers.js returns an object with input_ids as BigInt64Array or similar
        const inputIds = encoded.input_ids?.data ?? encoded.input_ids ?? encoded;
        return Array.from(inputIds).map((id: any) => Number(id));
    }

    /**
     * Decodes token IDs back into text.
     * @param tokens Array of token IDs.
     * @returns Decoded text string.
     */
    public decode(tokens: number[]): string {
        return this._tokenizer.decode(tokens, { skip_special_tokens: true });
    }
}
