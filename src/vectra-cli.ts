import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { LocalDocumentIndex } from "./LocalDocumentIndex";
import { WebFetcher } from './WebFetcher';
import { AzureOpenAIEmbeddingsOptions, OSSEmbeddingsOptions, OpenAIEmbeddings, OpenAIEmbeddingsOptions } from './OpenAIEmbeddings';
import { Colorize } from './internals';
import { FileFetcher } from './FileFetcher';
import { LocalFileStorage } from './storage/LocalFileStorage';
import { VirtualFileStorage } from './storage/VirtualFileStorage';
import { IndexCodec, JsonCodec, ProtobufCodec, detectCodec, migrateIndex, FormatName } from './codecs';
import { VectraServer } from './server/VectraServer';
import { FolderWatcher } from './FolderWatcher';

function getStorage(args: any) {
  if (args.storage === 'virtual') {
    return new VirtualFileStorage();
  } else {
    return new LocalFileStorage(args.storageRoot);
  }
}

function getCodecFromFormat(format?: string): IndexCodec | undefined {
  if (format === 'protobuf') return new ProtobufCodec();
  if (format === 'json') return new JsonCodec();
  return undefined; // default
}

export async function run() {
  // prettier-ignore
  const args = await yargs(hideBin(process.argv))
    .scriptName('vectra')
    .option('storage', {
      describe: 'storage backend to use',
      choices: ['local', 'virtual'],
      default: 'local'
    })
    .option('storage-root', {
      describe: 'root folder for local storage (only applies if storage=local)',
      type: 'string'
    })
    .command('create <index>', `create a new local index`, (yargs) => {
      return yargs.option('format', {
        describe: 'serialization format for the index',
        choices: ['json', 'protobuf'] as const,
        default: 'json' as const
      });
    }, async (args) => {
      const folderPath = args.index as string;
      const storage = getStorage(args);
      const codec = getCodecFromFormat(args.format);
      const index = new LocalDocumentIndex({ folderPath, storage, codec });
      const formatLabel = args.format === 'protobuf' ? 'protobuf' : 'json';
      console.log(Colorize.output(`creating ${formatLabel} index at ${folderPath}`));
      await index.createIndex({ version: 1, deleteIfExists: true });
    })
    .command('delete <index>', `delete an existing local index`, {}, async (args) => {
      const folderPath = args.index as string;
      console.log(Colorize.output(`deleting index at ${folderPath}`));
      const storage = getStorage(args);
      const codec = await detectCodec(folderPath, storage).catch(() => undefined);
      const index = new LocalDocumentIndex({ folderPath, storage, codec });
      await index.deleteIndex();
    })
    .command('add <index>', `adds one or more web pages to an index`, (yargs) => {
      return yargs
        .option('keys', {
          alias: 'k',
          describe: 'path of a JSON file containing the model keys to use for generating embeddings',
          type: 'string'
        })
        .option('uri', {
          alias: 'u',
          array: true,
          describe: 'http/https link to a web page to add',
          type: 'string'
        })
        .option('list', {
          alias: 'l',
          describe: 'path to a file containing a list of web pages to add',
          type: 'string'
        })
        .option('cookie', {
          alias: 'c',
          describe: 'optional cookies to add to web fetch requests',
          type: 'string'
        })
        .option('chunk-size', {
          alias: 'cs',
          describe: 'size of the generated chunks in tokens (defaults to 512)',
          type: 'number',
          default: 512
        })
        .check((argv) => {
          if (Array.isArray(argv.uri) && argv.uri.length > 0) {
            return true;
          } else if (typeof argv.list == 'string' && argv.list.trim().length > 0) {
            return true;
          } else {
            throw new Error(`you must specify either one or more "--uri <link>" for the pages to add or a "--list <file path>" for a file containing the list of pages to add.`);
          }
        })
        .demandOption(['keys']);
    }, async (args) => {
      console.log(Colorize.title('Adding Web Pages to Index'));
      // Get embedding options
      const options: OpenAIEmbeddingsOptions | AzureOpenAIEmbeddingsOptions | OSSEmbeddingsOptions = JSON.parse(await fs.readFile(args.keys as string, 'utf-8'));
      if ((options as OpenAIEmbeddingsOptions).apiKey && !(options as OpenAIEmbeddingsOptions).model) {
        (options as OpenAIEmbeddingsOptions).model = 'text-embedding-ada-002';
        (options as OpenAIEmbeddingsOptions).maxTokens = 8000;
      }
      // Create embeddings
      const embeddings = new OpenAIEmbeddings(options);
      // Initialize index
      const folderPath = args.index as string;
      const storage = getStorage(args);
      const codec = await detectCodec(folderPath, storage).catch(() => undefined);
      const index = new LocalDocumentIndex({
        folderPath,
        embeddings,
        chunkingConfig: {
          chunkSize: args.chunkSize
        },
        storage,
        codec
      });
      // Get list of url's
      const uris = await getItemList(args.uri as string[], args.list as string, 'web page');
      // Fetch documents
      const fileFetcher = new FileFetcher();
      const webFetcher = args.cookie ? new WebFetcher({ headers: { "cookie": args.cookie } }) : new WebFetcher();
      for (const path of uris) {
        try {
          console.log(Colorize.progress(`fetching ${path}`));
          const fetcher = path.startsWith('http') ? webFetcher : fileFetcher;
          await fetcher.fetch(path, async (uri, text, docType) => {
            console.log(Colorize.replaceLine(Colorize.progress(`indexing ${uri}`)));
            await index.upsertDocument(uri, text, docType);
            console.log(Colorize.replaceLine(Colorize.success(`added ${uri}`)));
            return true;
          });
        } catch (err: unknown) {
          console.log(Colorize.replaceLine(Colorize.error(`Error adding: ${path}\n${(err as Error).message}`)));
        }
      }
    })
    .command('remove <index>', `removes one or more documents from an index`, (yargs) => {
      return yargs
        .option('uri', {
          alias: 'u',
          array: true,
          describe: 'uri of a document to remove',
          type: 'string'
        })
        .option('list', {
          alias: 'l',
          describe: 'path to a file containing a list of documents to remove',
          type: 'string'
        })
        .check((argv) => {
          if (Array.isArray(argv.uri) && argv.uri.length > 0) {
            return true;
          } else if (typeof argv.list == 'string' && argv.list.trim().length > 0) {
            return true;
          } else {
            throw new Error(`you must specify either one or more "--uri <link>" for the pages to add or a "--list <file path>" for a file containing the list of pages to add.`);
          }
        });
    }, async (args) => {
      // Initialize index
      const folderPath = args.index as string;
      const storage = getStorage(args);
      const codec = await detectCodec(folderPath, storage).catch(() => undefined);
      const index = new LocalDocumentIndex({ folderPath, storage, codec });
      // Get list of uri's
      const uris = await getItemList(args.uri as string[], args.list as string, 'document');
      // Remove documents
      for (const uri of uris) {
        console.log(`removing ${uri}`);
        await index.deleteDocument(uri);
      }
    })
    .command('stats <index>', `prints the stats for a local index`, (yargs) => {
      return yargs;
    }, async (args) => {
      const folderPath = args.index as string;
      const storage = getStorage(args);
      // Auto-detect format from files on disk
      const codec = await detectCodec(folderPath, storage);
      const index = new LocalDocumentIndex({ folderPath, storage, codec });
      const stats = await index.getCatalogStats();
      console.log(Colorize.title('Index Stats'));
      console.log(Colorize.output(stats));
    })
    .command('migrate <index>', `migrate an index between serialization formats`, (yargs) => {
      return yargs.option('to', {
        describe: 'target format',
        choices: ['json', 'protobuf'] as const,
        demandOption: true
      });
    }, async (args) => {
      const folderPath = args.index as string;
      const storage = getStorage(args);
      const to = args.to as FormatName;
      console.log(Colorize.output(`migrating index at ${folderPath} to ${to} format`));
      await migrateIndex(folderPath, { to, storage });
      console.log(Colorize.output(`migration complete`));
    })
    .command('query <index> <query>', `queries a local index`, (yargs) => {
      return yargs
        .option('keys', {
          alias: 'k',
          describe: 'path of a JSON file containing the model keys to use for generating embeddings'
        })
        .option('document-count', {
          alias: 'dc',
          describe: 'max number of documents to return (defaults to 10)',
          type: 'number',
          default: 10
        })
        .option('chunk-count', {
          alias: 'cc',
          describe: 'max number of chunks to return (defaults to 50)',
          type: 'number',
          default: 50
        })
        .option('section-count', {
          alias: 'sc',
          describe: 'max number of document sections to render (defaults to 1)',
          type: 'number',
          default: 1
        })
        .option('tokens', {
          alias: 't',
          describe: 'max number of tokens to render for each document section (defaults to 2000)',
          type: 'number',
          default: 2000
        })
        .option('format', {
          alias: 'f',
          describe: `format of the rendered results. Defaults to 'sections'`,
          choices: ['sections', 'stats', 'chunks'],
          default: 'sections'
        })
        .option('overlap', {
          alias: 'o',
          describe: `whether to add overlapping chunks to sections.`,
          type: 'boolean',
          default: true
        })
        .option('bm25', {
          alias: 'b',
          describe: 'Use Okapi-bm25 keyword search alogrithm to perform hybrid search - semantic + keyword. Displayed in blue during search.',
          type: 'boolean',
          default: false
        })
        .demandOption(['keys']);
    }, async (args) => {
      console.log(Colorize.title('Querying Index'));
      // Get embedding options
      const options: OpenAIEmbeddingsOptions | AzureOpenAIEmbeddingsOptions | OSSEmbeddingsOptions = JSON.parse(await fs.readFile(args.keys as string, 'utf-8'));
      if ((options as OpenAIEmbeddingsOptions).apiKey && !(options as OpenAIEmbeddingsOptions).model) {
        (options as OpenAIEmbeddingsOptions).model = 'text-embedding-ada-002';
        (options as OpenAIEmbeddingsOptions).maxTokens = 8000;
      }
      // Create embeddings
      const embeddings = new OpenAIEmbeddings(options);
      // Initialize index
      const folderPath = args.index as string;
      const storage = getStorage(args);
      const codec = await detectCodec(folderPath, storage).catch(() => undefined);
      const index = new LocalDocumentIndex({
        folderPath,
        embeddings,
        storage,
        codec
      });
      // Query index
      const query = args.query as string;
      const results = await index.queryDocuments(query, {
        maxDocuments: args.documentCount,
        maxChunks: args.chunkCount,
        isBm25: args.bm25 as boolean,
      });
      // Render results
      for (const result of results) {
        console.log(Colorize.output(result.uri));
        console.log(Colorize.value('score', result.score));
        console.log(Colorize.value('chunks', result.chunks.length));
        if (args.format == 'sections') {
          const sections = await result.renderSections(args.tokens, args.sectionCount, args.overlap);
          console.log(sections.length);
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const isBm25 = sections[i].isBm25;
            console.log(isBm25);
            console.log(Colorize.title(args.sectionCount == 1 ? 'Section' : `Section ${i + 1}`));
            console.log(Colorize.value('score', section.score));
            console.log(Colorize.value('tokens', section.tokenCount));
            console.log(Colorize.output(section.text, isBm25));
          }
        } else if (args.format == 'chunks') {
          const text = await result.loadText();
          for (let i = 0; i < result.chunks.length; i++) {
            const chunk = result.chunks[i];
            const startPos = chunk.item.metadata.startPos;
            const endPos = chunk.item.metadata.endPos;
            const isBm25 = Boolean(chunk.item.metadata.isBm25);
            console.log(Colorize.title(`Chunk ${i + 1}`));
            console.log(Colorize.value('score', chunk.score));
            console.log(Colorize.value('startPos', startPos));
            console.log(Colorize.value('endPos', endPos));
            console.log(Colorize.output(text.substring(startPos, endPos + 1), isBm25));
          }
        }
      }
    })
    .command('watch <index>', 'watch folders and automatically sync file changes into the index', (yargs) => {
      return yargs
        .option('keys', {
          alias: 'k',
          describe: 'path of a JSON file containing the model keys to use for generating embeddings',
          type: 'string'
        })
        .option('uri', {
          alias: 'u',
          array: true,
          describe: 'folder or file path to watch',
          type: 'string'
        })
        .option('list', {
          alias: 'l',
          describe: 'path to a file containing a list of folders/files to watch',
          type: 'string'
        })
        .option('extensions', {
          alias: 'e',
          array: true,
          describe: 'file extensions to include (e.g., .txt .md .html)',
          type: 'string'
        })
        .option('chunk-size', {
          alias: 'cs',
          describe: 'size of the generated chunks in tokens (defaults to 512)',
          type: 'number',
          default: 512
        })
        .option('debounce', {
          describe: 'debounce interval in milliseconds (defaults to 500)',
          type: 'number',
          default: 500
        })
        .check((argv) => {
          if (Array.isArray(argv.uri) && argv.uri.length > 0) {
            return true;
          } else if (typeof argv.list == 'string' && argv.list.trim().length > 0) {
            return true;
          } else {
            throw new Error(`you must specify either one or more "--uri <path>" for the folders/files to watch or a "--list <file path>" for a file containing the paths.`);
          }
        })
        .demandOption(['keys']);
    }, async (args) => {
      console.log(Colorize.title('Vectra Watch Mode'));

      // Get embedding options
      const options: OpenAIEmbeddingsOptions | AzureOpenAIEmbeddingsOptions | OSSEmbeddingsOptions = JSON.parse(await fs.readFile(args.keys as string, 'utf-8'));
      if ((options as OpenAIEmbeddingsOptions).apiKey && !(options as OpenAIEmbeddingsOptions).model) {
        (options as OpenAIEmbeddingsOptions).model = 'text-embedding-ada-002';
        (options as OpenAIEmbeddingsOptions).maxTokens = 8000;
      }

      // Create embeddings
      const embeddings = new OpenAIEmbeddings(options);

      // Initialize index
      const folderPath = args.index as string;
      const storage = getStorage(args);
      const codec = await detectCodec(folderPath, storage).catch(() => undefined);
      const index = new LocalDocumentIndex({
        folderPath,
        embeddings,
        chunkingConfig: {
          chunkSize: args.chunkSize
        },
        storage,
        codec
      });

      // Get list of paths to watch
      const watchPaths = await getItemList(args.uri as string[], args.list as string, 'path');

      // Create watcher
      const watcher = new FolderWatcher({
        index,
        paths: watchPaths,
        extensions: args.extensions as string[] | undefined,
        debounceMs: args.debounce
      });

      // Wire up events
      watcher.on('sync', (uri: string, action: string) => {
        if (action === 'deleted') {
          console.log(Colorize.warning(`removed ${uri}`));
        } else {
          console.log(Colorize.success(`${action} ${uri}`));
        }
      });
      watcher.on('error', (err: Error, uri: string) => {
        console.log(Colorize.error(`Error syncing ${uri}: ${err.message}`));
      });

      // Start watching
      console.log(Colorize.progress(`performing initial sync...`));
      await watcher.start();
      console.log(Colorize.success(`initial sync complete (${watcher.trackedFileCount} files tracked)`));
      console.log(Colorize.output(`watching for changes... (press Ctrl+C to stop)`));

      // Handle graceful shutdown
      const handleSignal = async () => {
        console.log(Colorize.output('\nStopping watcher...'));
        await watcher.stop();
        process.exit(0);
      };
      process.on('SIGINT', handleSignal);
      process.on('SIGTERM', handleSignal);
    })
    .command('generate', 'generate language bindings for the gRPC service', (yargs) => {
      return yargs
        .option('language', {
          alias: 'l',
          describe: 'target language for the generated bindings',
          choices: ['python', 'csharp', 'rust', 'go', 'java', 'typescript'] as const,
          demandOption: true
        })
        .option('output', {
          alias: 'o',
          describe: 'output directory for the generated files',
          type: 'string',
          demandOption: true
        });
    }, async (args) => {
      const language = args.language as string;
      const outputDir = path.resolve(args.output as string);

      // Locate the proto file — check lib/ first (installed package), then project root
      const protoSearchPaths = [
        path.join(__dirname, '..', 'proto', 'vectra_service.proto'),
        path.join(__dirname, '..', '..', 'proto', 'vectra_service.proto'),
      ];
      let protoSource: string | undefined;
      for (const p of protoSearchPaths) {
        if (fsSync.existsSync(p)) {
          protoSource = p;
          break;
        }
      }
      if (!protoSource) {
        console.error(Colorize.error('Could not locate vectra_service.proto'));
        process.exit(1);
      }

      // Locate the template directory
      const templateSearchPaths = [
        path.join(__dirname, '..', 'src', 'templates', language),
        path.join(__dirname, 'templates', language),
      ];
      let templateDir: string | undefined;
      for (const p of templateSearchPaths) {
        if (fsSync.existsSync(p)) {
          templateDir = p;
          break;
        }
      }
      if (!templateDir) {
        console.error(Colorize.error(`Could not locate template for language: ${language}`));
        process.exit(1);
      }

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Copy proto file
      const protoDest = path.join(outputDir, 'vectra_service.proto');
      await fs.copyFile(protoSource, protoDest);
      console.log(Colorize.success(`copied vectra_service.proto`));

      // Copy all template files
      const templateFiles = await fs.readdir(templateDir);
      for (const file of templateFiles) {
        const src = path.join(templateDir, file);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          const dest = path.join(outputDir, file);
          await fs.copyFile(src, dest);
          console.log(Colorize.success(`copied ${file}`));
        }
      }

      console.log(Colorize.output(`\nGenerated ${language} bindings in ${outputDir}`));

      // Print next steps
      const nextSteps: Record<string, string> = {
        python: [
          'Next steps:',
          '  pip install grpcio grpcio-tools',
          '  python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. vectra_service.proto',
        ].join('\n'),
        csharp: [
          'Next steps:',
          '  dotnet add package Grpc.Net.Client',
          '  dotnet add package Google.Protobuf',
          '  dotnet add package Grpc.Tools',
          '  Add <Protobuf Include="vectra_service.proto" GrpcServices="Client" /> to your .csproj',
        ].join('\n'),
        rust: [
          'Next steps:',
          '  Ensure protoc is installed (apt install protobuf-compiler / brew install protobuf)',
          '  cargo build  (tonic-build generates stubs automatically)',
        ].join('\n'),
        go: [
          'Next steps:',
          '  go install google.golang.org/protobuf/cmd/protoc-gen-go@latest',
          '  go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest',
          '  protoc --go_out=. --go-grpc_out=. vectra_service.proto',
          '  Update the import path in vectra_client.go to match your module',
        ].join('\n'),
        java: [
          'Next steps:',
          '  Place vectra_service.proto in src/main/proto/',
          '  Add gRPC dependencies to your build tool (see README.md for Gradle/Maven)',
          '  Build to generate stubs automatically',
        ].join('\n'),
        typescript: [
          'Next steps:',
          '  npm install @grpc/grpc-js @grpc/proto-loader',
          '  No codegen needed — proto is loaded dynamically at runtime',
          '  import { VectraClient } from \'./VectraClient\';',
        ].join('\n'),
      };
      console.log(Colorize.output(nextSteps[language]));
    })
    .command('serve [index]', 'start the gRPC server to serve indexes', (yargs) => {
      return yargs
        .positional('index', {
          describe: 'path to a single index directory (mutually exclusive with --root)',
          type: 'string'
        })
        .option('root', {
          describe: 'directory containing multiple index subdirectories',
          type: 'string'
        })
        .option('port', {
          alias: 'p',
          describe: 'port to bind the gRPC server on',
          type: 'number',
          default: 50051
        })
        .option('daemon', {
          describe: 'fork to background as a daemon process',
          type: 'boolean',
          default: false
        })
        .option('pid-file', {
          describe: 'path to PID file (daemon mode only)',
          type: 'string'
        })
        .option('keys', {
          alias: 'k',
          describe: 'path to a JSON file containing the model keys for embeddings',
          type: 'string'
        })
        .check((argv) => {
          if (!argv.index && !argv.root) {
            throw new Error('You must provide either an <index> path or --root <dir>');
          }
          if (argv.index && argv.root) {
            throw new Error('<index> and --root are mutually exclusive');
          }
          return true;
        });
    }, async (args) => {
      // Load embeddings if keys provided
      let embeddings: OpenAIEmbeddings | undefined;
      if (args.keys) {
        const options: OpenAIEmbeddingsOptions | AzureOpenAIEmbeddingsOptions | OSSEmbeddingsOptions = JSON.parse(await fs.readFile(args.keys as string, 'utf-8'));
        if ((options as OpenAIEmbeddingsOptions).apiKey && !(options as OpenAIEmbeddingsOptions).model) {
          (options as OpenAIEmbeddingsOptions).model = 'text-embedding-ada-002';
          (options as OpenAIEmbeddingsOptions).maxTokens = 8000;
        }
        embeddings = new OpenAIEmbeddings(options);
      }

      const server = new VectraServer({
        port: args.port,
        indexPath: args.index as string | undefined,
        rootDir: args.root as string | undefined,
        embeddings,
      });

      if (args.daemon) {
        // Daemon mode: fork a child process
        const { spawn } = require('child_process');
        const cliArgs = process.argv.slice(2).filter(a => a !== '--daemon');
        const child = spawn(process.execPath, [process.argv[1], ...cliArgs], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        // Write PID file
        const pidFile = args.pidFile as string || path.join(
          (args.root as string) || path.dirname(args.index as string),
          '.vectra.pid'
        );
        await fs.writeFile(pidFile, String(child.pid));
        console.log(Colorize.output(`Vectra server started as daemon (PID: ${child.pid})`));
        console.log(Colorize.output(`PID file: ${pidFile}`));
        process.exit(0);
      } else {
        // Foreground mode
        const port = await server.start();
        console.log(Colorize.output(`Vectra gRPC server listening on 127.0.0.1:${port}`));

        const loaded = server.indexManager.listIndexes();
        if (loaded.length > 0) {
          console.log(Colorize.output(`Loaded indexes:`));
          for (const idx of loaded) {
            console.log(Colorize.output(`  - ${idx.name} (${idx.format}, ${idx.isDocumentIndex ? 'document' : 'item'})`));
          }
        } else {
          console.log(Colorize.output(`No indexes loaded yet. Use CreateIndex RPC or add index directories.`));
        }

        // Handle graceful shutdown
        const handleSignal = async () => {
          console.log(Colorize.output('\nShutting down...'));
          await server.shutdown();
          process.exit(0);
        };
        process.on('SIGINT', handleSignal);
        process.on('SIGTERM', handleSignal);
      }
    })
    .command('stop', 'stop a running Vectra daemon', (yargs) => {
      return yargs.option('pid-file', {
        describe: 'path to PID file',
        type: 'string',
        demandOption: true
      });
    }, async (args) => {
      const pidFile = args.pidFile as string;
      if (!fsSync.existsSync(pidFile)) {
        console.log(Colorize.error(`PID file not found: ${pidFile}`));
        process.exit(1);
      }
      const pid = parseInt(await fs.readFile(pidFile, 'utf-8'), 10);
      if (isNaN(pid)) {
        console.log(Colorize.error(`Invalid PID in file: ${pidFile}`));
        process.exit(1);
      }

      try {
        // Send SIGTERM for graceful shutdown
        process.kill(pid, 'SIGTERM');
        console.log(Colorize.output(`Sent SIGTERM to PID ${pid}`));

        // Wait up to 10s for process to exit
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          try {
            process.kill(pid, 0); // check if process exists
            await new Promise(r => setTimeout(r, 500));
          } catch {
            // Process no longer exists
            break;
          }
        }

        // Check if still alive and force kill
        try {
          process.kill(pid, 0);
          process.kill(pid, 'SIGKILL');
          console.log(Colorize.output(`Force-killed PID ${pid}`));
        } catch {
          // Already dead
        }

        // Remove PID file
        await fs.unlink(pidFile).catch(() => {});
        console.log(Colorize.output('Vectra server stopped'));
      } catch (err: any) {
        if (err.code === 'ESRCH') {
          console.log(Colorize.output(`Process ${pid} not running. Cleaning up PID file.`));
          await fs.unlink(pidFile).catch(() => {});
        } else {
          console.log(Colorize.error(`Failed to stop server: ${err.message}`));
          process.exit(1);
        }
      }
    })
    .help()
    .demandCommand()
    .parseAsync();
}

async function getItemList(items: string[], listFile: string, uriType: string): Promise<string[]> {
  if (Array.isArray(items) && items.length > 0) {
    return items;
  } else if (typeof listFile == 'string' && listFile.trim().length > 0) {
    const list = await fs.readFile(listFile, 'utf-8');
    return list.split('\n').map((item) => item.trim()).filter((item) => item.length > 0);
  } else {
    throw new Error(`you must specify either one or more "--uri <${uriType}>" for the items or a "--list <file path>" for a file containing the items.`);
  }
}