# context-diet

Strip the parts of your source code that models already know how to infer. Keep signatures, structure, and logic — drop comments, import ceremony, type boilerplate, and (when you want it) function bodies.

This is a local CLI. No API keys, no proxy, no model calls. You point it at files, it gives you smaller files.

## Why this exists

Pasting a repo into Claude or Cursor burns context on things the model doesn't need: JSDoc restating the obvious, fifteen-line import blocks, interface fields it could guess, and string literals it won't execute anyway.

Tools like [Fuse](https://github.com/litenova/Fuse) and [Headroom](https://github.com/headroomlabs-ai/headroom) solve this at a different layer — Fuse fuses whole directories into token-budgeted bundles; Headroom sits in front of your API and compresses tool outputs on the fly with reversible CCR caching. context-diet is narrower: one command, one file or folder, deterministic output you can read before you paste it.

Tradeoff is intentional. You don't get Headroom's proxy integration or Fuse's MCP server. You do get something you can run in a pre-commit hook, pipe into a prompt, or batch over `src/` in 50ms without configuring anything.

## Compression presets

Three levels, tuned for the usual "I need the model to understand this file" workflow:

| Preset | What it does | Typical savings | Use when |
|--------|--------------|-----------------|----------|
| `safe` | Comments, whitespace, import summary | 30–45% | You still want runnable logic |
| `balanced` | + collapse interfaces, enums, type aliases | 45–65% | Default. Good for orienting a model |
| `aggressive` | + skeleton functions/classes, collapse long strings | 65–85% | You only need the API surface |

```bash
context-diet -p balanced src/api.ts
context-diet -p aggressive src/        # whole directory
context-diet --skeleton src/handlers.ts  # same as aggressive
```

`balanced` is the default. It matches what most people actually want: the model sees what the file exports and how types connect, without wading through implementation.

## Install

```bash
npm install
npm run build
npm link   # optional
```

Node 18+. Native `tree-sitter` bindings — `npm install` compiles them locally.

## Usage

```bash
# single file, print result
context-diet --print src/app.ts

# directory (skips node_modules, dist, .git, etc.)
context-diet src/

# write compressed copies
context-diet -o ./out src/

# interactive — pick preset and paths
context-diet -i

# quiet summary only
context-diet --quiet src/
```

### Flags worth knowing

```
-p, --preset <safe|balanced|aggressive>   compression level (default: balanced)
--no-comments    leave comments
--no-imports     leave import statements
--no-whitespace  leave formatting alone
--print          stdout
-o, --output     write .diet files
-w, --context-window <n>  for the savings estimate (default: 128000)
```

## What it actually removes

**Comments** — line, block, JSDoc, Python docstrings. String literals are untouched.

**Imports** — replaced with one line: `// imports: react,axios`. Package names are deduplicated (you won't see `react` and `useState` listed separately).

**Type declarations** (balanced+) — `interface User { id: string; ... }` becomes `interface User{}`. Large type aliases collapse to `type Foo=...`.

**Function bodies** (aggressive) — `async function load(id: string): Promise<User> { ... }` becomes `async function load(id:string):Promise<User>{}`. Signatures stay; implementation goes.

**Long strings** (aggressive) — literals over 32 chars become `""`. The model knows a string is there without reading your 400-char error message.

**Whitespace** — C-style languages get minified. Python keeps indentation (breaking that would break the file).

## Token counts

Counts use `gpt-tokenizer` (cl100k_base, same family as GPT-4). The summary shows input tokens, output tokens, percent saved, and what fraction of your context window that frees up.

These numbers won't match Claude's tokenizer exactly. The relative savings are what matter — if you go from 4,200 to 1,600 tokens, that's real context back regardless of provider.

## Supported languages

TypeScript, JavaScript, Python. Extension-based detection — `.ts`, `.tsx`, `.js`, `.jsx`, `.py`. Files with TypeScript syntax in `.js` are parsed with the TS grammar automatically.

## How it works

```
strip comments → parse once (tree-sitter)
  → stub imports → collapse types → skeleton bodies
  → collapse literals → minify whitespace
```

Each AST pass re-parses after mutations so byte offsets stay correct. Typical file: under 20ms on a laptop.

```
src/
  index.ts           CLI
  presets.ts         safe / balanced / aggressive
  parser/            tree-sitter wrappers
  optimizers/        one module per transform
  pipeline/          stage orchestration
  tokens/            gpt-tokenizer counts
```

## Development

```bash
npm test
npm run dev -- --print -p aggressive tests/fixtures/sample.ts
```

Tests check that output still parses, that safe mode keeps logic, and that aggressive mode beats balanced on token count.

## License

MIT
