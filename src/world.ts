// What the host tells the island, worked out from plain data. extension.ts
// gathers diagnostics and git state from VS Code and hands them here as strings
// and numbers, so the shaping can be checked without VS Code running.

export interface ErrorRef {
  // Who the error is, stable while the lines above it move.
  key: string;
  uri: string;
  // The last segment of the path, for the chronicle.
  file: string;
  // 1-based, where the error is now.
  line: number;
}

export interface DiagnosticLike {
  uri: string;
  // 0-based, as VS Code reports it.
  line: number;
  code?: string | number;
  message: string;
}

// An error's identity is its file, its code and its message, plus which
// occurrence of that message in the file it is, counted from the top. Not its
// line: typing above an error moves its line on every keystroke, and a key that
// moved with it would kill the raider and land a new one each time.
//
// ponytail: two errors with the same message in one file are told apart only
// by order, so fixing the upper one hands the lower one its key and the kill is
// labelled with the lower one's line. Matching by nearest line would fix that.
export function errorRefs(diags: DiagnosticLike[]): ErrorRef[] {
  const sorted = [...diags].sort((a, b) =>
    a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : a.line - b.line
  );
  const seen = new Map<string, number>();
  return sorted.map((d) => {
    const base = `${d.uri}|${d.code ?? ""}|${d.message}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: `${base}#${n}`, uri: d.uri, file: fileName(d.uri), line: d.line + 1 };
  });
}

function fileName(uri: string): string {
  const last = uri.split(/[\\/]/).pop() || uri;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

// Uncommitted files across every repository, each counted once: a file that is
// staged and then changed again is one file of work, not two.
export function countDirty(
  repos: { index: string[]; workingTree: string[]; untracked: string[] }[]
): number {
  const files = new Set<string>();
  for (const r of repos)
    for (const uri of [...r.index, ...r.workingTree, ...r.untracked]) files.add(uri);
  return files.size;
}
