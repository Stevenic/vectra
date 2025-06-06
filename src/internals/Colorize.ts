const colorizer = require('json-colorizer');

/**
 * @private
 */
export class Colorize {
    public static replaceLine(text: string): string {
        return '\x1b[A\x1b[2K' + text;
    }

    public static error(error: Error|string): string {
        if (typeof error === 'string') {
            return `\x1b[31;1m${error}\x1b[0m`;
        } else {
            return `\x1b[31;1m${error.message}\x1b[0m`;
        }
    }

    public static output(output: object | string, isBm25: boolean = false, quote: string = '', units: string = ''): string {
        if (typeof output === 'string') {
            return isBm25 ? `\x1b[34m${quote}${output}${quote}\x1b[0m` : `\x1b[32m${quote}${output}${quote}\x1b[0m`;
        } else if (typeof output === 'object' && output !== null) {
            return colorizer(output, {
                pretty: true,
                colors: {
                    BRACE: 'white',
                    BRACKET: 'white',
                    COLON: 'white',
                    COMMA: 'white',
                    STRING_KEY: 'white',
                    STRING_LITERAL: 'green',
                    NUMBER_LITERAL: 'blue',
                    BOOLEAN_LITERAL: 'blue',
                    NULL_LITERAL: 'blue'
                }
            });
        } else if (typeof output == 'number') {
            return `\x1b[34m${output}${units}\x1b[0m`;
        } else {
            return `\x1b[34m${output}\x1b[0m`;
        }
    }

    public static progress(message: string): string {
        return message;
    }

    public static success(message: string): string {
        return `\x1b[32;1m${message}\x1b[0m`;
    }

    public static title(title: string): string {
        return `\x1b[35;1m${title}\x1b[0m`;
    }

    public static value(field: string, value: any, units: string = ''): string {
        return `${field}: ${Colorize.output(value, false, '"', units)}`;
    }

    public static warning(warning: string): string {
        return `\x1b[33m${warning}\x1b[0m`;

    }
}