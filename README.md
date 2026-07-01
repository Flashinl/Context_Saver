# context-diet

**Shrink source code for LLM context windows — without breaking syntax.**

Paste a 700-token Express controller into Claude and you pay for every JSDoc line, every interface field, and every import path twice. context-diet strips that noise locally in milliseconds, reports exactly how many tokens you saved, and leaves code the model can still parse.

```bash
npm install && npm run build
context-diet -p balanced src/controllers/auth.ts
```

No API keys. No proxy. One CLI.

---

## Before & After

Real file from our benchmark suite: an Express-style auth controller with JSDoc, Zod schemas, typed interfaces, and a full `loginHandler` implementation.

**Before — 723 tokens** (`tests/benchmarks/express-controller.ts`)

```typescript
/**
 * @fileoverview User authentication controller — handles login, logout, and session refresh.
 * @module controllers/auth
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
// ... 7 more imports

/** Credentials accepted by the login endpoint */
export interface LoginCredentials {
  /** User email address */
  email: string;
  /** Plain-text password (validated server-side) */
  password: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; role: "admin" | "member" | "viewer" };
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Validate incoming payload against schema
  const parsed = loginSchema.safeParse(req.body);
  // ... bcrypt compare, JWT signing, prisma.session.create, res.json(...)
}
```

**After — 93 tokens** (`context-diet -p aggressive`)

```typescript
// imports: bcryptjs,express,jsonwebtoken,zod
export interface LoginCredentials{}
export interface AuthTokenResponse{}
const loginSchema=z.object({email:z.string().email(),password:z.string().min(8).max(128)});
export async function loginHandler(req:Request,res:Response,next:NextFunction):Promise<void>{}
export const login=rateLimit({windowMs:60_000,max:10})(loginHandler);
```

| | Tokens | What the model still sees |
|---|--------|---------------------------|
| Before | **723** | Full implementation, comments, verbose types |
| After (balanced) | **341** (−53%) | Runnable logic, collapsed interfaces, stubbed imports |
| After (aggressive) | **93** (−87%) | API surface only — signatures, no bodies |

The aggressive output is valid TypeScript. tree-sitter confirms it parses cleanly. The model knows *what* the module exports without reading 600 tokens of bcrypt boilerplate.

---

## Why AST, not regex?

Most "context saver" scripts do this:

```python
code = code.replace(r"/\*[\s\S]*?\*/", "")   # delete block comments
code = code.replace(r"//.*", "")              # delete line comments
```

That works until it doesn't.

| Scenario | Regex approach | context-diet (tree-sitter) |
|----------|----------------|----------------------------|
| `const url = "https://api.example.com"` | Can eat `//api.example.com` inside the string | String node is protected — URL stays |
| `` const tpl = `value // not a comment` `` | Breaks on `//` inside template | Template literal span is protected |
| `const re = /https?:\/\//` | `/` triggers false comment match | Regex node is protected |
| Python `"""docstring"""` | Regex can't distinguish docstring from code | AST finds first string in block scope |
| After stripping | May produce **invalid syntax** | Re-validated — `hasError === false` |

**tree-sitter parses code the same way a compiler does.** It builds a concrete syntax tree, marks every string/template/regex span as untouchable, and only removes comment nodes outside those ranges. The LLM receives snippets that still type-check structurally — not mangled half-strings that confuse the next completion.

Regex is structurally blind. AST is structurally aware. That difference is the whole product.

---

## Benchmarks

Measured with `gpt-tokenizer` (cl100k_base) on representative open-source patterns. Run yourself: `npm run benchmark`.

| File | Preset | Before | After | Saved |
|------|--------|--------|-------|-------|
| Express auth controller | safe | 723 | 378 | **47.7%** |
| Express auth controller | balanced | 723 | 341 | **52.8%** |
| Express auth controller | aggressive | 723 | 93 | **87.1%** |
| React pagination hook | safe | 467 | 300 | **35.8%** |
| React pagination hook | balanced | 467 | 263 | **43.7%** |
| React pagination hook | aggressive | 467 | 45 | **90.4%** |
| Python order service | safe | 551 | 453 | **17.8%** |
| Python order service | balanced | 551 | 314 | **43.0%** |
| Python order service | aggressive | 551 | 106 | **80.8%** |

Python saves less at `safe` because indentation is preserved (collapsing it would break the file). At `balanced` and above, type/docstring stripping catches up.

---

## Compression presets

| Preset | What it does | Use when |
|--------|--------------|----------|
| `safe` | Comments, whitespace, import summary | You need runnable logic intact |
| `balanced` | + collapse interfaces, enums, type aliases | **Default** — orient the model on structure |
| `aggressive` | + skeleton bodies, collapse long strings | You only need the API map |

```bash
context-diet -p balanced src/api.ts       # default
context-diet -p aggressive src/handlers/   # signatures only
context-diet --print src/app.ts            # stdout
context-diet src/                          # whole directory
```

---

## Install

```bash
git clone https://github.com/Flashinl/Context_Saver.git
cd Context_Saver
npm install
npm run build
npm link   # optional — global `context-diet` command
```

Node 18+. Installs native tree-sitter bindings on `npm install`.

---

## Token economics

Every run prints exact token counts and estimated API savings:

```
saved      629 (87%)
api cost   $0.0016 estimated savings
```

Counts use `gpt-tokenizer`. Default pricing is $2.50/1M input tokens (GPT-4o). Override with `--price-per-million 15` for Claude Opus-tier estimates.

---

## Directory traversal

`context-diet src/` respects `.gitignore`, skips `node_modules` / `.git` / lockfiles, sniffs binary content, and only touches `.ts`, `.js`, `.py` source.

---

## How it works

```
parse (tree-sitter) → strip comments outside protected spans
  → stub imports → collapse types → skeleton bodies
  → collapse literals → minify whitespace → validate syntax
```

Typical file: **under 50ms** on a laptop. Each AST mutation re-parses so byte offsets stay correct.

---

## Development

```bash
npm test
npm run benchmark
npm run dev -- --print -p aggressive tests/benchmarks/express-controller.ts
```

## License

MIT
