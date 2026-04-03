import * as grpc from '@grpc/grpc-js';
import { IndexManager } from '../IndexManager';
import { wrapHandler } from './helpers';

export function createLifecycleHandlers(
    manager: IndexManager,
    startTime: number,
    onShutdown: () => void
) {
    return {
        Healthcheck: wrapHandler(async (_call: grpc.ServerUnaryCall<any, any>) => {
            const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
            return {
                status: 'ok',
                uptime_seconds: uptimeSeconds,
                loaded_indexes: manager.indexes.size,
            };
        }),

        Shutdown: wrapHandler(async (_call: grpc.ServerUnaryCall<any, any>) => {
            // Trigger graceful shutdown asynchronously
            process.nextTick(onShutdown);
            return {};
        }),
    };
}
