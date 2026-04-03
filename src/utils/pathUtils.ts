/**
 * Universal path utilities that work in Node, Browser, and Electron.
 * Replaces Node's 'path' module for cross-platform compatibility.
 */
export const pathUtils = {
    /**
     * Path separator. Always '/' for consistency across platforms.
     */
    sep: '/' as const,
    /**
     * Join path segments together.
     */
    join(...parts: string[]): string {
        return parts
            .map((part, i) => {
                if (i === 0) return part.replace(/[/\\]+$/, '');
                return part.replace(/^[/\\]+|[/\\]+$/g, '');
            })
            .filter(Boolean)
            .join('/');
    },

    /**
     * Get the last portion of a path.
     */
    basename(filePath: string, ext?: string): string {
        const base = filePath.split(/[/\\]/).pop() || '';
        if (ext && base.endsWith(ext)) {
            return base.slice(0, -ext.length);
        }
        return base;
    },

    /**
     * Get the directory name of a path.
     */
    dirname(filePath: string): string {
        const parts = filePath.split(/[/\\]/);
        parts.pop();
        return parts.join('/') || '.';
    },

    /**
     * Get the extension of the path.
     */
    extname(filePath: string): string {
        const base = pathUtils.basename(filePath);
        const dotIndex = base.lastIndexOf('.');
        return dotIndex > 0 ? base.slice(dotIndex) : '';
    },

    /**
     * Normalize a path, resolving '..' and '.' segments.
     */
    normalize(filePath: string): string {
        const isAbsolute = filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath);
        const parts = filePath.split(/[/\\]/);
        const result: string[] = [];

        for (const part of parts) {
            if (part === '..') {
                result.pop();
            } else if (part !== '.' && part !== '') {
                result.push(part);
            }
        }

        return (isAbsolute && !(/^[a-zA-Z]:/.test(filePath)) ? '/' : '') + result.join('/');
    },

    /**
     * Determine if a path is absolute.
     */
    isAbsolute(filePath: string): boolean {
        return filePath.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(filePath);
    },

    /**
     * Get the relative path from one path to another.
     */
    relative(from: string, to: string): string {
        const fromParts = pathUtils.normalize(from).split('/').filter(Boolean);
        const toParts = pathUtils.normalize(to).split('/').filter(Boolean);

        // Find common prefix
        let commonLength = 0;
        while (
            commonLength < fromParts.length &&
            commonLength < toParts.length &&
            fromParts[commonLength] === toParts[commonLength]
        ) {
            commonLength++;
        }

        // Build relative path
        const upCount = fromParts.length - commonLength;
        const relativeParts = [
            ...Array(upCount).fill('..'),
            ...toParts.slice(commonLength)
        ];

        return relativeParts.join('/') || '.';
    }
};

export default pathUtils;
