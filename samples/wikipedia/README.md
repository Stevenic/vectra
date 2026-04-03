# Wikipedia Sample

Builds a Vectra document index using the CLI, indexing the [Top 25 Wikipedia Articles for 2023](https://wikimediafoundation.org/news/2023/12/05/announcing-wikipedias-most-popular-articles-of-2023/).

> **Note:** This sample uses the CLI only — no TypeScript code. For programmatic examples, see the [quickstart](../quickstart/) or [rag](../rag/) samples.

## Prerequisites

- Node.js 22.x or later
- Vectra installed globally: `npm install -g vectra`
- An OpenAI API key

## Setup

Create a `vectra.keys` file in this folder:

```json
{
    "apiKey": "<YOUR OPENAI API KEY>"
}
```

## Build the Index

```bash
# Create an empty document index
vectra create index

# Crawl Wikipedia articles into the index (~185 MB, takes several minutes)
vectra add index -k vectra.keys -l wikipedia.links
```

## Query the Index

```bash
vectra query index "name taylor swifts biggest hits" -k vectra.keys
```

By default, the CLI returns text using the Document Sections algorithm. To return raw chunks instead:

```bash
vectra query index "name taylor swifts biggest hits" -k vectra.keys -f chunks
```

## Other Commands

```bash
# View index stats
vectra stats index

# Delete the index
vectra delete index
```

## Learn More

- [CLI Reference](https://stevenic.github.io/vectra/cli)
- [Document Indexing guide](https://stevenic.github.io/vectra/documents)
