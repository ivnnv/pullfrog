// gitignore-style filtering for the files a review reads. A repo can commit a
// `.pullfrogignore` (same syntax as `.gitignore`) listing globs whose changes
// the reviewer should skip — vendored trees, generated bundles, lockfiles.
// Dropping them before the diff is formatted keeps large vendor/sync PRs from
// spending the model's input context on code nobody reviews.
//
// Supported syntax (the common `.gitignore` subset):
//   - `#` comments and blank lines are ignored
//   - a leading `/`, or any `/` in the middle, anchors the pattern to the repo
//     root; a pattern with no slash matches a basename at any depth
//   - a trailing `/` matches a directory and everything under it
//   - `**` matches across path separators; `*` and `?` do not cross `/`
//   - a leading `!` re-includes a path a prior pattern excluded (last rule wins)
//
// Not supported (rare in practice, intentionally omitted to stay dependency
// free): character classes (`[a-z]`) and escaped literal `\*`.

export type IgnoreMatcher = (path: string) => boolean;

type Rule = { re: RegExp; negate: boolean };

/** Strip comments and blank lines, returning the raw glob patterns in order. */
export function parsePullfrogIgnore(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\r$/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function escapeLiteral(ch: string): string {
  return ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function compileRule(raw: string): Rule {
  let pattern = raw;
  const negate = pattern.startsWith("!");
  if (negate) pattern = pattern.slice(1);

  const dirOnly = pattern.endsWith("/");
  if (dirOnly) pattern = pattern.replace(/\/+$/, "");

  let anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);
  // a slash left anywhere in the pattern also anchors it to the root
  if (!anchored && pattern.includes("/")) anchored = true;

  let body = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        body += ".*";
        i++;
        if (pattern[i + 1] === "/") i++;
      } else {
        body += "[^/]*";
      }
    } else if (ch === "?") {
      body += "[^/]";
    } else {
      body += escapeLiteral(ch);
    }
  }

  const prefix = anchored ? "^" : "^(?:.*/)?";
  // the path itself or anything nested below it, so a directory rule (or a
  // bare name) also drops every file underneath
  const suffix = "(?:/.*)?$";
  return { re: new RegExp(prefix + body + suffix), negate };
}

/**
 * Build a matcher from `.pullfrogignore` patterns. Returns true when a path is
 * ignored. Rules are applied in order and the last matching rule wins, so a
 * later `!pattern` can re-include a path an earlier rule excluded.
 */
export function makeIgnoreMatcher(patterns: string[]): IgnoreMatcher {
  const rules = patterns.map(compileRule);
  return (path: string): boolean => {
    let ignored = false;
    for (const rule of rules) {
      if (rule.re.test(path)) ignored = !rule.negate;
    }
    return ignored;
  };
}
