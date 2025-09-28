module.exports = function override(config, env) {
  // Add fallbacks for node core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "querystring": require.resolve("querystring-es3"),
    "crypto": require.resolve("crypto-browserify"),
    "url": require.resolve("url/"),
    "buffer": require.resolve("buffer/"),
    "stream": require.resolve("stream-browserify"),
    "process": require.resolve("process/browser"),
    "util": require.resolve("util/"),
    "http": false,
    "https": false,
    "zlib": false,
    "path": false,
    "fs": false,
    "net": false,
    "tls": false
  };

  // Add process and Buffer polyfills
  const webpack = require('webpack');
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  return config;
};