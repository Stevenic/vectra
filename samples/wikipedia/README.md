# Wikipedia Sample
This sample shows how to manually build a Vectra document index using the [vectra](https://www.npmjs.com/package/vectra) CLI tool. We will be building an index containing the [Top 25 Wikipedia Articles for 2023](https://wikimediafoundation.org/news/2023/12/05/announcing-wikipedias-most-popular-articles-of-2023/).

## Install the Vectra CLI
You'll first need to install the latest version of Vectra globally using npm or yarn:

```bash
npm install -g vectra
```

## Configure OpenAI API Key
Next you'll need to generate an OpenAI API Key in the [API keys](https://platform.openai.com/api-keys) section of the OpenAI Developer Portal. Create a file called `vectra.keys` in the sample folder and replace the `<YOUR OPENAI API KEY>` part of the JSON below with your API key:

```json
{
    "apiKey": "<YOUR OPENAI API KEY>"
}
```

## Create an Empty Index
First you need to create an empty document index using the CLI:

```bash
vectra create index
```

The name of the index can be anything you want but in this sample we'll just call it "index".

> To delete the index you just created you can run `vectra delete index` or simply delete the folder that was created.

## Add Items to Index
Next we need to crawl documents into our newly created index using the `vectra add` command:

```bash
vectra add index -k vectra.keys -l wikipedia.links
```

This process will take several minutes and result in an index that's around 185mb in size. The add command has the following structure:

```bash
vectra add <index name> -k <key file> -l <ingest list>
```

As an alternative to providing a file containing a list of documents to index, you can specify documents individually using the `-u <document uri>` argument.

> For a complete list of crawling options run `vectra add --help`.

## Query the Index
Now that we've built our index, we can use the CLI to execute a test query:

```bash
vectra query index "name taylor swifts biggest hits" -k vectra.keys 
```

This will query the index showing you the text that will be returned to your application at query time. You can take this text and paste into into a prompt on [playground](https://platform.openai.com/playground?mode=chat) to test the quality of answers you'll get back from the model. By default, the CLI returns text using it's `Document Sections` algorithm. You can switch to returning the raw chunks instead by adding `-f chunks` to your query.

> For a complete list of query options run `vectra query --help`
