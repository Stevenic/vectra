import * as assert from 'assert';
import * as grpc from '@grpc/grpc-js';
import { fromProtoMetadata, toProtoMetadata, parseFilterJson, grpcError, wrapHandler } from './helpers';

describe('helpers', () => {
    describe('fromProtoMetadata', () => {
        it('should return empty object for undefined input', () => {
            const result = fromProtoMetadata(undefined);
            assert.deepStrictEqual(result, {});
        });

        it('should convert string_value fields', () => {
            const result = fromProtoMetadata({ name: { string_value: 'hello' } });
            assert.deepStrictEqual(result, { name: 'hello' });
        });

        it('should convert stringValue fields (camelCase)', () => {
            const result = fromProtoMetadata({ name: { stringValue: 'hello' } });
            assert.deepStrictEqual(result, { name: 'hello' });
        });

        it('should convert number_value fields', () => {
            const result = fromProtoMetadata({ score: { number_value: 0.95 } });
            assert.deepStrictEqual(result, { score: 0.95 });
        });

        it('should convert numberValue fields (camelCase)', () => {
            const result = fromProtoMetadata({ score: { numberValue: 0.95 } });
            assert.deepStrictEqual(result, { score: 0.95 });
        });

        it('should convert bool_value fields', () => {
            const result = fromProtoMetadata({ active: { bool_value: true } });
            assert.deepStrictEqual(result, { active: true });
        });

        it('should convert boolValue fields (camelCase)', () => {
            const result = fromProtoMetadata({ active: { boolValue: false } });
            assert.deepStrictEqual(result, { active: false });
        });

        it('should handle mixed types', () => {
            const result = fromProtoMetadata({
                name: { string_value: 'test' },
                count: { number_value: 42 },
                flag: { bool_value: true },
            });
            assert.deepStrictEqual(result, { name: 'test', count: 42, flag: true });
        });

        it('should skip non-object values', () => {
            const result = fromProtoMetadata({ bad: null as any });
            assert.deepStrictEqual(result, {});
        });

        it('should skip objects without recognized value keys', () => {
            const result = fromProtoMetadata({ weird: { unknown_key: 'x' } });
            assert.deepStrictEqual(result, {});
        });
    });

    describe('toProtoMetadata', () => {
        it('should return empty object for undefined input', () => {
            const result = toProtoMetadata(undefined);
            assert.deepStrictEqual(result, {});
        });

        it('should convert string values', () => {
            const result = toProtoMetadata({ name: 'hello' });
            assert.deepStrictEqual(result, { name: { string_value: 'hello' } });
        });

        it('should convert number values', () => {
            const result = toProtoMetadata({ score: 0.95 });
            assert.deepStrictEqual(result, { score: { number_value: 0.95 } });
        });

        it('should convert boolean values', () => {
            const result = toProtoMetadata({ active: true });
            assert.deepStrictEqual(result, { active: { bool_value: true } });
        });

        it('should handle mixed types', () => {
            const result = toProtoMetadata({ name: 'test', count: 42, flag: false });
            assert.deepStrictEqual(result, {
                name: { string_value: 'test' },
                count: { number_value: 42 },
                flag: { bool_value: false },
            });
        });
    });

    describe('parseFilterJson', () => {
        it('should return undefined for undefined input', () => {
            assert.strictEqual(parseFilterJson(undefined), undefined);
        });

        it('should return undefined for null input', () => {
            assert.strictEqual(parseFilterJson(null), undefined);
        });

        it('should return undefined for empty filter_json', () => {
            assert.strictEqual(parseFilterJson({ filter_json: '' }), undefined);
        });

        it('should parse valid JSON filter', () => {
            const result = parseFilterJson({ filter_json: '{"category":"test"}' });
            assert.deepStrictEqual(result, { category: 'test' });
        });

        it('should parse complex filter', () => {
            const result = parseFilterJson({ filter_json: '{"$and":[{"score":{"$gte":0.5}},{"tag":"a"}]}' });
            assert.deepStrictEqual(result, { $and: [{ score: { $gte: 0.5 } }, { tag: 'a' }] });
        });

        it('should throw INVALID_ARGUMENT for invalid JSON', () => {
            try {
                parseFilterJson({ filter_json: '{bad json' });
                assert.fail('Expected error');
            } catch (err: any) {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.ok(err.message.includes('Invalid filter_json'));
            }
        });
    });

    describe('grpcError', () => {
        it('should create a ServiceError with code and message', () => {
            const err = grpcError(grpc.status.NOT_FOUND, 'Item not found');
            assert.strictEqual(err.code, grpc.status.NOT_FOUND);
            assert.strictEqual(err.message, 'Item not found');
            assert.strictEqual(err.details, 'Item not found');
            assert.ok(err.metadata instanceof grpc.Metadata);
        });
    });

    describe('wrapHandler', () => {
        function makeCall(request: any): any {
            return { request } as any;
        }

        it('should call callback with result on success', (done) => {
            const handler = wrapHandler(async (call: any) => {
                return { value: call.request.input };
            });

            handler(makeCall({ input: 42 }), (err: any, result: any) => {
                assert.strictEqual(err, null);
                assert.deepStrictEqual(result, { value: 42 });
                done();
            });
        });

        it('should pass through gRPC errors with code', (done) => {
            const handler = wrapHandler(async () => {
                throw grpcError(grpc.status.INVALID_ARGUMENT, 'bad input');
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.INVALID_ARGUMENT);
                assert.strictEqual(err.message, 'bad input');
                done();
            });
        });

        it('should map "not found" errors to NOT_FOUND', (done) => {
            const handler = wrapHandler(async () => {
                throw new Error('Index not found: test');
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.NOT_FOUND);
                done();
            });
        });

        it('should map "does not exist" errors to NOT_FOUND', (done) => {
            const handler = wrapHandler(async () => {
                throw new Error('File does not exist');
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.NOT_FOUND);
                done();
            });
        });

        it('should map "already exists" errors to ALREADY_EXISTS', (done) => {
            const handler = wrapHandler(async () => {
                throw new Error('Index already exists: test');
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.ALREADY_EXISTS);
                done();
            });
        });

        it('should map "not a document index" errors to FAILED_PRECONDITION', (done) => {
            const handler = wrapHandler(async () => {
                throw new Error('Index "test" is not a document index');
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.FAILED_PRECONDITION);
                done();
            });
        });

        it('should map unknown errors to INTERNAL', (done) => {
            const handler = wrapHandler(async () => {
                throw new Error('something broke');
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.INTERNAL);
                assert.ok(err.message.includes('something broke'));
                done();
            });
        });

        it('should handle errors with no message', (done) => {
            const handler = wrapHandler(async () => {
                throw {};
            });

            handler(makeCall({}), (err: any) => {
                assert.strictEqual(err.code, grpc.status.INTERNAL);
                assert.ok(err.message.includes('Internal server error'));
                done();
            });
        });
    });
});
