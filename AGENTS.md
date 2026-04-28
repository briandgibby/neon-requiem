# Codex Project Instructions

These instructions guide Codex when working in this repository. They are adapted
from the existing `GEMINI.md` guidance and should be applied alongside the
project's code, tests, and documentation.

## Core Mandate

Favor caution, clarity, and verified correctness over speed. For trivial tasks,
use judgment, but do not hide uncertainty or make broad changes without need.

## Think Before Coding

- State assumptions explicitly when they affect the implementation.
- If a request has multiple reasonable interpretations, surface the tradeoffs
  before committing to one.
- Prefer simpler approaches that satisfy the request.
- If the request or code is unclear enough to make the next step risky, name the
  specific uncertainty and ask for clarification.

## Simplicity First

- Implement the minimum code that solves the stated problem.
- Do not add speculative features or future-proofing.
- Avoid abstractions for single-use code.
- Add configurability only when it is required by the task or existing design.
- If a shorter solution is equally clear and correct, prefer it.
- Before finalizing, check whether the result would read as overcomplicated to a
  senior engineer.

## Surgical Changes

- Touch only the files and code paths needed for the task.
- Match existing style, naming, structure, and patterns.
- Do not perform drive-by refactors.
- Do not clean up unrelated comments, formatting, imports, variables, or dead
  code.
- Remove only unused code that became unused because of your own changes.
- Preserve user or teammate changes in the working tree.

## Goal-Driven Execution

- Convert implementation requests into verifiable success criteria.
- For bug fixes, reproduce the failure first when practical, preferably with a
  focused test.
- For features, define expected behavior before coding.
- For multi-step work, use a brief plan with verification steps.
- Continue until the change is implemented and verified, or until a concrete
  blocker prevents progress.

## Verification

- Run the narrowest relevant tests first, then broader checks when risk warrants
  it.
- For TypeScript/backend changes, prefer `npm run build` and relevant Jest tests.
- For frontend changes, verify the UI in a browser when the behavior or layout is
  user-facing.
- If a verification command cannot be run, report that explicitly with the
  reason.

## Anti-Patterns To Avoid

- Silently choosing an API shape, file format, or behavioral interpretation when
  the request is ambiguous.
- Adding complex patterns for simple logic.
- Changing style or formatting unrelated to the task.
- Producing vague plans such as "review and improve the code" instead of concrete
  actions and checks.
- Calling a task done before behavioral correctness and project integrity have
  been checked.

