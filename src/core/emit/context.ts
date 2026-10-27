// Warnings collected while the emitters write Typst. Pure: no Obsidian, Node,
// or I/O imports.

/** A conversion problem with its place in the source note (US-006). */
export interface Warning {
  /** Code from docs/technical/warning-codes.md. */
  code: string;
  message: string;
  /** 1-based line of the source note. */
  line: number;
}

/**
 * US-001 AC-9, AC-15 | US-015 AC-12: collects the warnings of one export.
 *
 * One instance per export; the emitters call `warn` for a problem and
 * `commentDropped` for every removed HTML comment. `finish()` returns the
 * warnings sorted by line (stable, so the order of occurrence breaks ties)
 * plus the single `COMMENT_DROPPED` summary. It does not change the context,
 * so it can be called more than once.
 */
export class EmitContext {
  private readonly warnings: Warning[] = [];
  private comments = 0;
  private firstCommentLine = 0;
  private fitImage = false;

  /** Reports one warning. */
  warn(code: string, message: string, line: number): void {
    this.warnings.push({code, message, line});
  }

  /** Counts a dropped HTML comment; the summary names the first one's line. */
  commentDropped(line: number): void {
    if (this.comments === 0 || line < this.firstCommentLine) {
      this.firstCommentLine = line;
    }
    this.comments += 1;
  }

  /** Records that an image was placed with the `fit-image` helper. */
  markFitImagePlaced(): void {
    this.fitImage = true;
  }

  /** True when a placed image needs the `fit-image` helper (US-015 AC-2). */
  get fitImagePlaced(): boolean {
    return this.fitImage;
  }

  /** The warnings of the export, ordered by line, with the comment summary. */
  finish(): Warning[] {
    const result = [...this.warnings];
    if (this.comments > 0) {
      result.push({
        code: 'COMMENT_DROPPED',
        message:
          this.comments === 1
            ? '1 HTML comment dropped'
            : `${this.comments} HTML comments dropped`,
        line: this.firstCommentLine,
      });
    }
    return result.sort((a, b) => a.line - b.line);
  }
}
