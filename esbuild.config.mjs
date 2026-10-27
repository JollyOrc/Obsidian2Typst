// Bundles src/plugin/main.ts into main.js for Obsidian (see build/build-plugin.mjs).
import {buildPlugin} from './build/build-plugin.mjs';

await buildPlugin({outfile: 'main.js'});
