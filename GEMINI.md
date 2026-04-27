# Gemini CLI Coding Guidelines

These guidelines are based on Andrej Karpathy's observations on LLM coding pitfalls and are designed to improve quality, maintainability, and reliability across all projects.

**Core Mandate:** These guidelines take absolute precedence over general workflows. Bias toward **caution over speed**. For trivial tasks, use judgment.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing any change:
- **State assumptions explicitly:** If anything is uncertain, ask for clarification instead of guessing.
- **Present interpretations:** If a request has multiple valid interpretations, present them and their tradeoffs rather than picking one silently.
- **Propose simpler paths:** If a simpler approach exists that fulfills the spirit of the request, suggest it.
- **Stop when confused:** If the code or request is unclear, name the specific source of confusion and wait for user input.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

Avoid the tendency toward overengineering:
- **No speculative features:** Do not implement features or "future-proofing" that wasn't explicitly requested.
- **Avoid early abstraction:** Do not create abstractions for single-use code.
- **Minimal configurability:** Only add "flexibility" or "configurability" if specifically requested.
- **Rewrite for brevity:** If a solution can be implemented in 50 lines instead of 200, rewrite it.
- **The Senior Engineer Test:** Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- **Minimal footprint:** Do not "improve" adjacent code, comments, or formatting unless requested.
- **Respect existing patterns:** Match the existing style, naming conventions, and patterns, even if you personally prefer a different approach.
- **No drive-by refactoring:** Do not refactor things that aren't broken or related to the task.
- **Handle orphans:** Only remove imports, variables, or functions that *your* changes made unused. Do not remove pre-existing dead code unless asked.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform imperative tasks into verifiable, declarative goals:
- **Reproduce bugs:** Before fixing a bug, write a test or script that reproduces the failure.
- **Tests first:** For new features, define the success criteria through tests before implementation.
- **Incremental verification:** For multi-step tasks, provide a brief plan with verification steps:
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
  ```
- **Loop independently:** Use strong success criteria to verify your own work without needing constant user confirmation of "is this right?".

## Anti-Patterns to Avoid
- **Hidden Assumptions:** Silently choosing a file format or API structure without asking.
- **Over-abstraction:** Implementing a Strategy pattern for a simple calculation.
- **Style Drift:** Changing quote styles or adding type hints while performing an unrelated fix.
- **Vague Plans:** "I'll review and improve the code" vs "I'll write a test for bug X and make it pass."

**A task is only complete when the behavioral correctness of the change has been verified and its structural integrity is confirmed within the full project context.**
