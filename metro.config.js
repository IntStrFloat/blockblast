// Keep generated bundles, old checkouts and emulator images out of Metro's crawl.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');
const config = getDefaultConfig(__dirname);
const root = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...config.resolver.blockList,
  // The crawler supplies absolute paths, while Windows FallbackWatcher uses relative paths.
  new RegExp(`^(?:${root}[/\\\\])?(?:output|dist|web-dist|reports|\\.worktrees|\\.claude)(?:[/\\\\]|$)`),
  new RegExp(`^(?:${root}[/\\\\])?\\.omx[/\\\\]audio-avd(?:[/\\\\]|$)`),
  new RegExp(`^(?:${root}[/\\\\])?\\.expo[/\\\\]metro-file-map-node-\\d+(?:[/\\\\]|$)`),
  /(?:^|[/\\])(?:\.cxx|\.gradle|\.kotlin)(?:[/\\]|$)/,
  /(?:^|[/\\])android[/\\]build(?:[/\\]|$)/,
];
config.fileMapCacheDirectory = path.join(__dirname, '.expo', `metro-file-map-node-${process.versions.node.split('.')[0]}`);
fs.mkdirSync(config.fileMapCacheDirectory, { recursive: true });
module.exports = config;
