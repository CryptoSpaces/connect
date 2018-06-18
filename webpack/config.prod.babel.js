import {
    SRC,
    HTML_SRC,
    DATA_SRC,
    JS_SRC,
    DIST,
    LIB_NAME,
    NODE_MODULES,
    PORT
} from './constants';

import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import UglifyJsPlugin from 'uglifyjs-webpack-plugin';

module.exports = {
    mode: 'production',
    entry: {
        'trezor-connect': `${JS_SRC}entrypoints/connect.js`,
        'iframe': ['babel-polyfill', `${JS_SRC}iframe/iframe.js`], // babel-polyfill is not compiled into trezor-link
        'popup': `${JS_SRC}popup/popup.js`,
        'webusb': `${JS_SRC}entrypoints/webusb.js`
    },
    output: {
        filename: 'js/[name].[hash].js',
        path: DIST,
        publicPath: './',
        library: LIB_NAME,
        libraryTarget: 'umd',
        libraryExport: 'default'
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: ['babel-loader']
            },
            {
                test: /\.less$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                        options: { publicPath: '../' }
                    },
                    'css-loader',
                    'less-loader',
                ]
            },
            {
                test: /\.(png|gif|jpg)$/,
                loader: 'file-loader?name=./images/[name].[ext]',
                query: {
                    outputPath: './images',
                    name: '[name].[hash].[ext]',
                }
            },
            {
                test: /\.(ttf|eot|svg|woff|woff2)$/,
                loader: 'file-loader',
                query: {
                    outputPath: './fonts',
                    name: '[name].[hash].[ext]',
                },
            },
            {
                test: /\.wasm$/,
                loader: 'file-loader',
                query: {
                    name: 'js/[name].[hash].[ext]',
                },
            },
            {
                type: 'javascript/auto',
                test: /\.json/,
                exclude: /node_modules/,
                loader: 'file-loader',
                query: {
                    outputPath: './data',
                    name: '[name].[hash].[ext]',
                },
            },
        ]
    },
    resolve: {
        modules: [ SRC, NODE_MODULES ],
        alias: {
            'flowtype/trezor': `${SRC}flowtype/empty.js`,
        }
    },
    performance: {
        hints: false
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'css/[name].[hash].css',
            chunkFilename: '[id].css',
        }),

        new HtmlWebpackPlugin({
            chunks: ['iframe'],
            filename: `iframe.html`,
            template: `${HTML_SRC}iframe.html`,
            inject: true
        }),
        new HtmlWebpackPlugin({
            chunks: ['popup'],
            filename: 'popup.html',
            template: `${HTML_SRC}popup.html`,
            inject: true
        }),
        new HtmlWebpackPlugin({
            chunks: ['webusb'],
            filename: `webusb.html`,
            template: `${HTML_SRC}webusb.html`,
            inject: true
        }),

        new CopyWebpackPlugin([
            { from: `${HTML_SRC}index.html`, to: `${DIST}index.html` },
            { from: `${HTML_SRC}webusb.html`, to: `${DIST}webusb.html` },
            { from: `${DATA_SRC}config.json`, to: `${DIST}data/config.json` },
            { from: `${DATA_SRC}coins.json`, to: `${DIST}data/coins.json` },
            { from: `${DATA_SRC}config_signed.bin`, to: `${DIST}data/config_signed.bin` },
            { from: `${DATA_SRC}messages.json`, to: `${DIST}data/messages.json` },
            { from: `${DATA_SRC}latest.txt`, to: `${DIST}data/latest.txt` },
            { from: `${DATA_SRC}releases-1.json`, to: `${DIST}data/releases-1.json` },
            { from: `${DATA_SRC}releases-2.json`, to: `${DIST}data/releases-2.json` },
            //{ from: `${SRC}images`, to: 'images' },
        ]),

        // ignore Node.js lib from trezor-link
        new webpack.IgnorePlugin(/\/iconv-loader$/),
    ],

    // bitcoinjs-lib NOTE:
    // When uglifying the javascript, you must exclude the following variable names from being mangled:
    // Array, BigInteger, Boolean, ECPair, Function, Number, Point and Script.
    // This is because of the function-name-duck-typing used in typeforce.
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                parallel: true,
                uglifyOptions: {
                    compress: {
                        warnings: false,
                    },
                    mangle: {
                        reserved: [
                            'Array', 'BigInteger', 'Boolean', 'Buffer',
                            'ECPair', 'Function', 'Number', 'Point', 'Script',
                        ],
                    }
                }
            })
        ]
    },



    // ignoring Node.js import in fastxpub (hd-wallet)
    node: {
        fs: "empty",
        path: "empty",
    }
}
