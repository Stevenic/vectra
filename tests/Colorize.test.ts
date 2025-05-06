import assert from "assert";
import { Colorize } from "../src/internals/Colorize";

describe("Colorize", () => {
    describe("output", () => {
        it("should handle strings", () => {
            const result = Colorize.output("test");
            assert(result.includes("test"));
        });

        it("should handle numbers", () => {
            const result = Colorize.output(42);
            assert(result.includes("42"));
        });

        it("should handle arrays", () => {
            const result = Colorize.output(["test", 42]);
            assert(result.includes("test"));
            assert(result.includes("42"));
        });

        it("should handle objects", () => {
            const result = Colorize.output({ key: "value" });
            assert(result.includes("key"));
            assert(result.includes("value"));
        });
    });

    describe("value", () => {
        it("should format field and value", () => {
            const result = Colorize.value("field", "value");
            assert(result.includes("field"));
            assert(result.includes("value"));
        });
    });
}); 