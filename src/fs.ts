import * as fs from 'fs/promises';

export async function access(path: string) {
    return fs.access(path)
}

export async function readText(path: string): Promise<string> {
    return (await fs.readFile(path)).toString()
}

export async function unlink(path: string) {
    await fs.unlink(path)
}

export async function writeFile(path: string, data: string) {
    await fs.writeFile(path, data)
}
