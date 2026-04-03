import * as assert from 'assert';
import * as sinon from 'sinon';
import { createLifecycleHandlers } from './lifecycleHandlers';
import { IndexManager } from '../IndexManager';

function callHandler(handler: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
        handler({ request } as any, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

describe('lifecycleHandlers', () => {
    let manager: sinon.SinonStubbedInstance<IndexManager>;
    beforeEach(() => {
        manager = sinon.createStubInstance(IndexManager);
        // Stub the indexes property
        sinon.stub(manager, 'indexes' as any).get(() => new Map([['a', {}], ['b', {}]]));
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Healthcheck', () => {
        it('should return status ok with uptime and loaded indexes', async () => {
            const startTime = Date.now() - 5000; // started 5 seconds ago
            const handlers = createLifecycleHandlers(manager as any, startTime, () => {});
            const result = await callHandler(handlers.Healthcheck, {});

            assert.strictEqual(result.status, 'ok');
            assert.ok(result.uptime_seconds >= 5);
            assert.strictEqual(result.loaded_indexes, 2);
        });

        it('should report 0 uptime when just started', async () => {
            const startTime = Date.now();
            const handlers = createLifecycleHandlers(manager as any, startTime, () => {});
            const result = await callHandler(handlers.Healthcheck, {});

            assert.strictEqual(result.uptime_seconds, 0);
        });
    });

    describe('Shutdown', () => {
        it('should call onShutdown callback', async () => {
            const onShutdown = sinon.stub();
            const handlers = createLifecycleHandlers(manager as any, Date.now(), onShutdown);
            const result = await callHandler(handlers.Shutdown, {});

            assert.deepStrictEqual(result, {});

            // onShutdown is called via process.nextTick, so wait a tick
            await new Promise(resolve => process.nextTick(resolve));
            assert.ok(onShutdown.calledOnce);
        });
    });
});
