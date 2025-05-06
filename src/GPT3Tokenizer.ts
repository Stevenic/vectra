import { Tokenizer } from "./types";
import { encode, decode } from "gpt-3-encoder";

/**
 * Tokenizer that uses the GPT-3 tokenizer.
 * @public
 */
export class GPT3Tokenizer implements Tokenizer {
    public decode(tokens: number[]): string {
        return decode(tokens);
    }

    public encode(text: string): number[] {
        return encode(text);
    }
}
