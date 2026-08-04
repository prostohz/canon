export const ERROR = "error";
export const WARNING = "warning";

export type Severity = typeof ERROR | typeof WARNING;

export class Diagnostic {
  constructor(
    readonly line: number,
    readonly column: number,
    readonly message: string,
    readonly severity: Severity = ERROR,
    readonly path = "",
    readonly label = "",
  ) {}

  at(path: string): Diagnostic {
    return new Diagnostic(
      this.line, this.column, this.message, this.severity, path, this.label,
    );
  }

  format(): string {
    if (this.path) return `${this.path}:${this.line}:${this.column}: ${this.message}`;
    if (this.label) return `${this.label}: ${this.message}`;
    return this.message;
  }
}

export class SpecError extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
    this.name = "SpecError";
  }
}
