// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Las migraciones de drizzle-kit son archivos .sql que Metro debe poder resolver
config.resolver.sourceExts.push('sql');

module.exports = config;
