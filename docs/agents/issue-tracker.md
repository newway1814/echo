# Issue Tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all issue operations.

## Repository

GitHub repository:

```txt
newway1814/echo
```

When running inside this checkout, infer the repository from `git remote -v`; `gh` should do this automatically.

## Conventions

- Create an issue: `gh issue create --title "..." --body "..."`
- Read an issue: `gh issue view <number> --comments`
- List issues: `gh issue list --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment <number> --body "..."`
- Apply a label: `gh issue edit <number> --add-label "..."`
- Remove a label: `gh issue edit <number> --remove-label "..."`
- Close an issue: `gh issue close <number> --comment "..."`

Use a body file for long Markdown issue bodies instead of trying to inline large PRDs in a shell command.

## Pull Requests As A Triage Surface

PRs as a request surface: no.

External PRs should not be pulled into the Matt Pocock triage queue by default. Treat GitHub Issues as the source of planned work.

## When A Skill Says "Publish To The Issue Tracker"

Create a GitHub issue.

Add `ready-for-agent` when the issue is fully specified and ready for an AFK agent to implement.

## When A Skill Says "Fetch The Relevant Ticket"

Run:

```txt
gh issue view <number> --comments
```

