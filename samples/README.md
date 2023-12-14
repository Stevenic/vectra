# Vectra Samples
There are two flavors of samples in this folder. Samples that show how to build Vectra indexes using the CLI, like the [wikipedia sample](./wikipedia/README.md), and samples that show how to consume a Vectra index programatically, like the [chat sample](./chat/README.md).

All samples will require an OpenAI key which can be generated in the [API keys](https://platform.openai.com/api-keys) section of the OpenAI Developer Portal. This key will need to be stored in a `vectra.keys` file at the root of each sample. **DO NOT CHECK IN ANY FILES WITH KEYS** OpenAI uses a key scanner and will automatically revoke any checked in keys. The `.gitignore` file in each sample has a rule to prevent checking the `vectra.keys` file in.

## Index Building Samples
These samples show how to use the `vectra` CLI command to manually build a Vectra document index. Vectra includes a crawler capable of indexing both local and web documents. The crawler uses Vectras [WebFetcher](../src/WebFetcher.ts) class, for indexing web documents, and [FileFetcher](../src/FileFetcher.ts) class, for indexing local documents.  The current crawler has the following capabilities and limitations:

- Only text based file formats are currently supported. PDF and Office file formats are planned but not implemented yet.
- HTML documents will be automatically converted to Markdown. This makes them smaller indexing wise and also token wise when rendering to an LLM.  Special table handling logic is included that converts HTML based tables to Markdown tables.
- The [WebFetcher](../src/WebFetcher.ts) class does not do link traversal so you have to provide the crawler with an explicit list of url's you'd like it to index.
- The [FileFetcher](../src/FileFetcher.ts) class does support folders. If you give it a folder path it will attempt to index every document in that folder and any child folders.

Here's the list of index building samples:

| Name | Description |
| ---- | ----------- |
| [wikipedia](./wikipedia/README.md) | Builds a Vectra index of the Top 25 Wikipedia Articles for 2023 |

## Index Consumption Samples
These samples show how to consume a Vectra document index programatically. Here's the list of index consumption samples:

| Name | Description |
| ---- | ----------- |
| [chat](./chat/README.md) | A simple CLI based chat experience for performing Retrieval Augmented Generation (RAG) using Vectra and an LLM |

