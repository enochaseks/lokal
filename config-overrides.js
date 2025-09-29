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
    "path": require.resolve("path-browserify"),
    "os": require.resolve("os-browserify"),
    "http": false,
    "https": false,
    "zlib": false,
    "fs": false,
    "net": false,
    "tls": false,
    "child_process": false,
    "worker_threads": false
  };

  // Add process and Buffer polyfills
  const webpack = require('webpack');
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ];

  // Add module resolution rules for problematic packages
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false, // disable the behaviour
    },
  });

  // Ignore certain warnings
  config.ignoreWarnings = [
    /Failed to parse source map/,
    /Critical dependency: the request of a dependency is an expression/,
  ];

  return config;
};