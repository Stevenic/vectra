import { LocalIndex } from 'vectra';
import { OpenAIApi, Configuration } from 'openai';
import { config } from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

// Read in .env file.
const ENV_FILE = path.join(__dirname, '..', '.env');
config({ path: ENV_FILE });

// Create OpenAI API client
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const api = new OpenAIApi(configuration);

// Create local index
const index = new LocalIndex(path.join(__dirname, '..', 'index'));


// Create a readline interface object with the standard input and output streams
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Define main chat loop
async function chat(botMessage: string|undefined) {
    async function getVector(text: string) {
        const response = await api.createEmbedding({
            'model': 'text-embedding-ada-002',
            'input': text,
        });
        return response.data.data[0].embedding;
    }

    // Show the bots message
    if (botMessage) {
        console.log(`\x1b[32m${botMessage}\x1b[0m`);
    }

    // Prompt the user for input
    rl.question('', async (input: string) => {
        // Initialize index if it doesn't exist
        if (!await index.isIndexCreated()) {
            await index.createIndex();
        }

        if (input.startsWith('-exit')) {
            // Close the readline interface and exit the process
            rl.close();
            process.exit();
        } else if (input.startsWith('-add')) {
            // Get the text to add
            const text = input.split('-add')[1].trim();
            const vector = await getVector(text);

            // Add the text to the index
            await index.insertItem({
                vector,
                metadata: { text }
            });
            await chat(`\x1b[32mAdded text to index.\x1b[0m`);
        } else if (input.startsWith('-delete')) {
            // Delete the index
            await index.deleteIndex();
            await chat(`\x1b[32mIndex deleted.\x1b[0m`);
        } else {
            // Query the index
            const vector = await getVector(input);
            const results = await index.queryItems(vector, 3);
            if (results.length > 0) {
                for (const result of results) {
                    await chat(`\x1b[32m[${result.score}] ${result.item.metadata.text}\x1b[0m`);
                }
            } else {
                await chat(`\x1b[32mNo results found.\x1b[0m`);
            }
        }
    });
}

// Start chat session
chat([
    `Vectra sample usage:`,
    `"-add <text>" will insert a new item into the index.`,
    `"-delete" will delete the index and start over.`,
    `"-exit" will exit the program.`,
    `Otherwise, type a question to query the index.`,
].join('\n'));