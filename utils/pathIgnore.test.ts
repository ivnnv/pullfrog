import { describe, expect, it } from "vitest";
import {
  makeIgnoreMatcher,
  parsePullfrogIgnore,
} from "./pathIgnore.ts";

describe("parsePullfrogIgnore", () => {
  it("drops comments, blanks, and trims whitespace / CR", () => {
    const text = ["# a comment", "", "  dist/  ", "*.lock\r", "   ", "# end"].join(
      "\n"
    );
    expect(parsePullfrogIgnore(text)).toEqual(["dist/", "*.lock"]);
  });
});

describe("makeIgnoreMatcher", () => {
  it("matches a bare name at any depth", () => {
    const ignored = makeIgnoreMatcher(["dist"]);
    expect(ignored("dist/a.js")).toBe(true);
    expect(ignored("packages/editor/dist/b.js")).toBe(true);
    expect(ignored("src/app.ts")).toBe(false);
  });

  it("treats a trailing slash as a directory prefix", () => {
    const ignored = makeIgnoreMatcher(["node_modules/"]);
    expect(ignored("node_modules/foo/index.js")).toBe(true);
    expect(ignored("app/node_modules/foo/index.js")).toBe(true);
    expect(ignored("src/main.ts")).toBe(false);
  });

  it("anchors a pattern that contains a slash", () => {
    const ignored = makeIgnoreMatcher(["build/output"]);
    expect(ignored("build/output/x.js")).toBe(true);
    expect(ignored("nested/build/output/x.js")).toBe(false);
  });

  it("anchors a leading-slash pattern to the root", () => {
    const ignored = makeIgnoreMatcher(["/pnpm-lock.yaml"]);
    expect(ignored("pnpm-lock.yaml")).toBe(true);
    expect(ignored("sub/pnpm-lock.yaml")).toBe(false);
  });

  it("matches an extension glob at any depth", () => {
    const ignored = makeIgnoreMatcher(["*.lock"]);
    expect(ignored("yarn.lock")).toBe(true);
    expect(ignored("packages/a/yarn.lock")).toBe(true);
    expect(ignored("a.locket")).toBe(false);
  });

  it("does not let * cross a path separator", () => {
    const ignored = makeIgnoreMatcher(["src/*.ts"]);
    expect(ignored("src/app.ts")).toBe(true);
    expect(ignored("src/deep/app.ts")).toBe(false);
  });

  it("lets ** cross path separators", () => {
    const ignored = makeIgnoreMatcher(["packages/**/dist"]);
    expect(ignored("packages/editor/dist/index.js")).toBe(true);
    expect(ignored("packages/dist/index.js")).toBe(true);
  });

  it("applies last-match-wins so ! re-includes", () => {
    const ignored = makeIgnoreMatcher(["dist/", "!dist/keep.js"]);
    expect(ignored("dist/bundle.js")).toBe(true);
    expect(ignored("dist/keep.js")).toBe(false);
  });

  it("treats ? as a single non-slash char", () => {
    const ignored = makeIgnoreMatcher(["file?.txt"]);
    expect(ignored("file1.txt")).toBe(true);
    expect(ignored("file/.txt")).toBe(false);
  });

  it("returns false for an empty pattern set", () => {
    const ignored = makeIgnoreMatcher([]);
    expect(ignored("anything.ts")).toBe(false);
  });
});
