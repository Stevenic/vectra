import * as grpc from '@grpc/grpc-js';
import { MetadataTypes } from '../../types';

/**
 * Converts proto MetadataValue map to a plain JS record.
 */
export function fromProtoMetadata(protoMeta: Record<string, any> | undefined): Record<string, MetadataTypes> {
    const result: Record<string, MetadataTypes> = {};
    if (!protoMeta) return result;
    for (const [key, val] of Object.entries(protoMeta)) {
        if (val && typeof val === 'object') {
            if ('string_value' in val || 'stringValue' in val) {
                result[key] = val.string_value ?? val.stringValue;
            } else if ('number_value' in val || 'numberValue' in val) {
                result[key] = val.number_value ?? val.numberValue;
            } else if ('bool_value' in val || 'boolValue' in val) {
                result[key] = val.bool_value ?? val.boolValue;
            }
        }
    }
    return result;
}

/**
 * Converts a plain JS metadata record to proto MetadataValue map.
 */
export function toProtoMetadata(meta: Record<string, MetadataTypes> | undefined): Record<string, any> {
    const result: Record<string, any> = {};
    if (!meta) return result;
    for (const [key, val] of Object.entries(meta)) {
        if (typeof val === 'string') {
            result[key] = { string_value: val };
        } else if (typeof val === 'number') {
            result[key] = { number_value: val };
        } else if (typeof val === 'boolean') {
            result[key] = { bool_value: val };
        }
    }
    return result;
}

/**
 * Parses the filter_json field from a MetadataFilter proto message.
 */
export function parseFilterJson(filter: any): Record<string, any> | undefined {
    if (!filter || !filter.filter_json || filter.filter_json === '') {
        return undefined;
    }
    try {
        return JSON.parse(filter.filter_json);
    } catch {
        throw grpcError(grpc.status.INVALID_ARGUMENT, 'Invalid filter_json: must be valid JSON');
    }
}

/**
 * Creates a gRPC ServiceError with the given status code and message.
 */
export function grpcError(code: grpc.status, message: string): grpc.ServiceError {
    const err = new Error(message) as grpc.ServiceError;
    err.code = code;
    err.details = message;
    err.metadata = new grpc.Metadata();
    return err;
}

/**
 * Wraps an async handler function with standard error mapping.
 */
export function wrapHandler<TReq, TRes>(
    handler: (call: grpc.ServerUnaryCall<TReq, TRes>) => Promise<TRes>
): grpc.handleUnaryCall<TReq, TRes> {
    return (call, callback) => {
        handler(call)
            .then(result => callback(null, result))
            .catch(err => {
                if (err && typeof err.code === 'number') {
                    callback(err);
                } else {
                    const message = err?.message || 'Internal server error';
                    if (message.includes('not found') || message.includes('does not exist')) {
                        callback(grpcError(grpc.status.NOT_FOUND, message));
                    } else if (message.includes('already exists')) {
                        callback(grpcError(grpc.status.ALREADY_EXISTS, message));
                    } else if (message.includes('not a document index')) {
                        callback(grpcError(grpc.status.FAILED_PRECONDITION, message));
                    } else {
                        callback(grpcError(grpc.status.INTERNAL, message));
                    }
                }
            });
    };
}
