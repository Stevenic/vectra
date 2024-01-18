import * as fs from 'fs/promises';

export async function access(path: string) {
    return fs.access(path)
}

export async function readText(path: string): Promise<string> {
    return (await fs.readFile(path)).toString()
}