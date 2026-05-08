# Kammie (kammie.ai) — Claude Code Instructions

## Project
Next.js + Supabase app. Package manager: pnpm.

## Response Style
- Terse. Code and key decisions only.
- No preamble, no summaries unless asked.
- No emoji, no filler phrases.
- If something is ambiguous, ask one short question before acting.

## Model Selection
Match model to task complexity:
- Haiku: quick lookups, renaming, formatting
- Sonnet: feature work, refactoring, writing tests, debugging
- Opus: multi-file architecture decisions, complex cross-system debugging

## Hard Rules
- Always run tests after code changes.
- Ask before modifying `.env` or `.env.local`. All other env files can be edited freely.
- Supabase schema, RLS policies, and destructive operations (deletes, drops, resets) are all permitted without asking.

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test`
- Lint: `pnpm lint`

## Stack
- Framework: Next.js (App Router assumed)
- Database: Supabase (Postgres + Auth + Storage)
- Styling: check package.json if unsure
- State: check codebase before assuming

## Context Hygiene
- Read each file once per session — do not re-read unless it has changed.
- Do not load files speculatively. Only read what is needed for the current task.
- If context is getting long, say so and suggest /compact.
