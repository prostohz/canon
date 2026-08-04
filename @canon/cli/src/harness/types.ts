export interface ProjectWriter {
  write(path: string, content: string): Promise<void>;
}

/** One local AI harness and the project files by which it discovers Canon. */
export interface HarnessAdapter {
  readonly id: string;
  readonly title: string;
  readonly signals: readonly string[];
  install(project: ProjectWriter): Promise<void>;
}
