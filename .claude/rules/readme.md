---
paths:
  - "README.md"
  - "**/README.md"
  - "**/docs/*.md"
---

# A README

How a README of this repository is written: the root README.md, an App's README, the README of a folder inside an
App, and a page under a `docs/` folder that a README links for its reference detail. It adapts funcd's
`.claude/rules/docs-guide.md` to a repository.

- **A neutral voice.** Never "you", "your" or "we". Name the actor, such as an operator, funcd or the lane, and write
  steps in the imperative.
- **Plain, complete written English** for a reader who knows the task but not the code: a subject and a verb in each
  sentence, articles kept, short sentences with one idea each, common words and precise verbs. Define a term before
  using it, keep exact identifiers, and avoid slang and long noun chains.
- **The goal and the expected result first.** The text under the title says what the App does and shows its smallest
  working run. A deploy step says what it achieves and the result that shows it worked.
- **Keep only what helps** a reader deploy, use, check or recover. Remove repeated facts and commentary that restates
  a manifest, a command or its output.
- **Keep every condition, default and scope word.** A default comes with its exceptions, and "only", "unless", "if"
  and "never" keep their scope, the same wherever the README states them.
- **A rewrite keeps every useful concept and task** of the README that it replaces, in the same README or in a page
  that it links. Record where each removed fact stands now, and check that coverage rather than the word count.
- **A short label introduces an example**, such as "The Site, in `app/resources/site.yaml`:". The example shows its
  own names, values and output.
- **No empty section, and no summary** that repeats the page.
- **A funcd ADR is cited only where a reader needs the decision behind a behavior**, as a link on the term that the
  ADR decides, never as a parenthesis after most sentences.
- **Check every fact in the code** on main before writing it, such as a default, a port or a file name. Run each
  command that the README shows, the way the README tells a reader to, or say in the PR which ones did not run.
- **Links are relative** to the README's folder, and each one resolves. YAML is block style, in a code fence too.
- **The template**, `scripts/readme-template.yaml`, gives each README shape its sections and their order.
- **The check**, `scripts/readme-check.py` in `just check` and the pre-commit hook, holds each README to the template
  and counts its words, fenced code included: it warns over 400 and fails over 600 for the root README, and warns over
  600 and fails over 900 for an App's README or a folder's inside an App.
