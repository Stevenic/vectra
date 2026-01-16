const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: './src/browser.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'vectra.browser.js',
        library: {
            name: 'Vectra',
            type: 'umd',
        },
        globalObject: 'this',
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            // Node.js polyfills for browser
            buffer: require.resolve('buffer/'),
            // Ignore Node.js-only modules
            fs: false,
            path: false,
            'fs/promises': false,
            tty: false,
            'node:path': false,
            'node:fs': false,
        },
        alias: {
            // Redirect LocalFileStorage imports to a stub
            './LocalFileStorage': path.resolve(__dirname, 'src/storage/LocalFileStorage.browser.ts'),
        },
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    // Provide Buffer globally
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
    // Generate source maps for debugging
    devtool: 'source-map',
    // Optimize for production
    optimization: {
        minimize: true,
    },
    // Ignore Node.js specific warnings
    ignoreWarnings: [
        /Critical dependency/,
    ],
};