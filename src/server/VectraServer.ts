import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { IndexManager, IndexManagerConfig } from './IndexManager';
import { EmbeddingsModel } from '../types';
import {
    createIndexHandlers,
    createItemHandlers,
    createQueryHandlers,
    createDocumentHandlers,
    createStatsHandlers,
    createLifecycleHandlers,
} from './handlers';

export interface VectraServerConfig {
    /** Port to bind the gRPC server on (default: 50051). */
    port?: number;
    /** Single index path (mutually exclusive with rootDir). */
    indexPath?: string;
    /** Root directory containing multiple index subdirectories. */
    rootDir?: string;
    /** Embeddings model for server-side embedding computation. */
    embeddings?: EmbeddingsModel;
    /** Polling interval in ms for auto-detecting new indexes (default: 3000). */
    scanInterval?: number;
}

const DRAIN_TIMEOUT_MS = 5000;

/**
 * gRPC server that exposes Vectra indexes over the VectraService proto.
 */
export class VectraServer {
    private readonly _config: VectraServerConfig;
    private readonly _indexManager: IndexManager;
    private _server?: grpc.Server;
    private _startTime: number = 0;
    private _shutdownPromise?: Promise<void>;

    constructor(config: VectraServerConfig) {
        this._config = config;
        const managerConfig: IndexManagerConfig = {
            indexPath: config.indexPath,
            rootDir: config.rootDir,
            embeddings: config.embeddings,
            scanInterval: config.scanInterval,
        };
        this._indexManager = new IndexManager(managerConfig);
    }

    /** The underlying IndexManager. */
    public get indexManager(): IndexManager {
        return this._indexManager;
    }

    /** The underlying gRPC server instance. */
    public get server(): grpc.Server | undefined {
        return this._server;
    }

    /**
     * Starts the gRPC server and loads indexes.
     * @returns The port the server is listening on.
     */
    public async start(): Promise<number> {
        this._startTime = Date.now();

        // Load proto definition
        const protoPath = path.resolve(__dirname, '..', '..', 'proto', 'vectra_service.proto');
        const packageDefinition = protoLoader.loadSync(protoPath, {
            keepCase: true,
            longs: Number,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
        const vectraService = protoDescriptor.vectra.VectraService;

        // Initialize index manager
        await this._indexManager.initialize();

        // Create gRPC server
        this._server = new grpc.Server();

        // Register all handler groups
        const indexHandlers = createIndexHandlers(this._indexManager);
        const itemHandlers = createItemHandlers(this._indexManager, this._config.embeddings);
        const queryHandlers = createQueryHandlers(this._indexManager, this._config.embeddings);
        const documentHandlers = createDocumentHandlers(this._indexManager);
        const statsHandlers = createStatsHandlers(this._indexManager);
        const lifecycleHandlers = createLifecycleHandlers(
            this._indexManager,
            this._startTime,
            () => this.shutdown()
        );

        this._server.addService(vectraService.service, {
            ...indexHandlers,
            ...itemHandlers,
            ...queryHandlers,
            ...documentHandlers,
            ...statsHandlers,
            ...lifecycleHandlers,
        });

        // Bind to localhost only
        const port = this._config.port ?? 50051;
        const boundPort = await new Promise<number>((resolve, reject) => {
            this._server!.bindAsync(
                `127.0.0.1:${port}`,
                grpc.ServerCredentials.createInsecure(),
                (err, actualPort) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(actualPort);
                    }
                }
            );
        });

        return boundPort;
    }

    /**
     * Gracefully shuts down the server with a 5s draining timeout.
     */
    public async shutdown(): Promise<void> {
        if (this._shutdownPromise) return this._shutdownPromise;

        this._shutdownPromise = (async () => {
            // Stop index manager scanning
            await this._indexManager.shutdown();

            if (!this._server) return;

            // Try graceful shutdown with timeout
            await new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                    this._server!.forceShutdown();
                    resolve();
                }, DRAIN_TIMEOUT_MS);

                this._server!.tryShutdown((err) => {
                    clearTimeout(timer);
                    resolve();
                });
            });

            this._server = undefined;
        })();

        return this._shutdownPromise;
    }
}
