// US-005: tables. Pure: no Obsidian, Node, or I/O imports.
//
// Layout (AC-1): `#table(`, `columns: n,`, `align: (...),`, the header, one body
// row per line, `)`. Every line inside is indented by two blanks.
import type {CellNode, TableNode} from '../parse';
import type {EmitContext} from './context';

const ALIGN = {left: 'left', center: 'center', right: 'right'} as const;

/** Words for the number of cells that were cut (AC-3). */
function longRow(extra: number): string {
  return extra === 1
    ? 'Row has 1 more cell than the header; it is cut'
    : `Row has ${extra} more cells than the header; they are cut`;
}

/**
 * US-005 AC-1, AC-2, AC-3, AC-3b: Typst for one table. `cell` renders the
 * content of one cell (without the brackets). `mark` gives the text put before
 * the table and each row for the line map (US-015 AC-8); default none. A short row is padded with empty
 * cells; the cells beyond the header are cut and reported.
 */
export function emitTable(
  table: TableNode,
  ctx: EmitContext,
  cell: (cell: CellNode) => string,
  mark: (line: number) => string = () => '',
): string {
  const header = table.children.find((row) => row.header);
  const columns = header?.children.length ?? table.align.length;
  if (columns === 0) return '';
  const aligns = Array.from(
    {length: columns},
    (_, i) => ALIGN[table.align[i] ?? 'left'],
  );
  const lines = [
    `${mark(table.line)}#table(`,
    `  columns: ${columns},`,
    `  align: (${aligns.join(', ')}${columns === 1 ? ',' : ''}),`,
  ];
  for (const row of table.children) {
    const extra =
      (row.extraCells ?? 0) + Math.max(0, row.children.length - columns);
    if (extra > 0) ctx.warn('TABLE_ROW_LONG', longRow(extra), row.line);
    const cells = Array.from({length: columns}, (_, i) => {
      const node = row.children[i];
      return `[${node === undefined ? '' : cell(node)}]`;
    });
    const at = `  ${mark(row.line)}`;
    lines.push(
      row.header
        ? `${at}table.header(${cells.join(', ')}),`
        : `${at}${cells.join(', ')},`,
    );
  }
  lines.push(')');
  return lines.join('\n');
}
