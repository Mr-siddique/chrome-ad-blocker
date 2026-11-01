const fs = require('fs');
const path = require('path');

const STATIC_FILES = [
  'manifest.json',
  'popup.html',
  'options.html',
  'styles/popup.css',
  'styles/options.css',
  'rules/streaming-rules.json',
  'rules/general-rules.json',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

class CopyStaticPlugin {
  apply(compiler) {
    const { RawSource } = compiler.webpack.sources;
    compiler.hooks.thisCompilation.tap('CopyStaticPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'CopyStaticPlugin', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          for (const file of STATIC_FILES) {
            const source = path.resolve(__dirname, 'src', file);
            if (!fs.existsSync(source)) continue;
            compilation.emitAsset(file, new RawSource(fs.readFileSync(source)));
          }
        }
      );
    });
  }
}

module.exports = {
  target: 'web',
  // Extension pages forbid eval, so the default eval-based dev devtool must be off.
  devtool: false,
  entry: {
    background: './src/background.js',
    'content-script': './src/content-script.js',
    'youtube-main': './src/youtube-main.js',
    popup: './src/popup.js',
    options: './src/options.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    globalObject: 'self',
    clean: true,
  },
  optimization: { splitChunks: false, runtimeChunk: false },
  plugins: [new CopyStaticPlugin()],
};
