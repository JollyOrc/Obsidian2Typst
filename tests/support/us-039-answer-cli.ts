// Test support: one process that prints the answer of `api.statblockTypst` for
// the manual's Fen Hare example as JSON, for US-039 AC-9 (two fresh processes).
import {createStatblockTypstApi} from '../../src/plugin/entries/typst-api';
import {ENTRIES} from './entries';

const api = createStatblockTypstApi({
  settings: async () => ({entries: ENTRIES}),
  readIconBytes: async (path) =>
    new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${path} --></svg>`,
    ),
  fonts: async () => [],
});
const answer = await api.statblockTypst(
  {
    vigour: 11,
    might: 4,
    wits: 2,
    speed: 5,
    attacks: ['Kick: 2d6', '**Bite**: 1d6'],
    skills: ['Quick Step', 'Keen Nose'],
    tags: ['beast'],
  },
  {heading: 'Fen Hare'},
);
process.stdout.write(
  JSON.stringify(answer, (_k, v) =>
    v instanceof Uint8Array ? Array.from(v) : v,
  ),
);
