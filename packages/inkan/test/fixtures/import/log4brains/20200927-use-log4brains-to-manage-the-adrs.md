# Use Log4brains to manage the ADRs

- Status: superseded by [Use Markdown ADRs](20201012-use-markdown-architectural-decision-records.md)
- Deciders: @jdoe, Jane Roe
- Date: 2020-09-27
- Tags: tooling, docs

Technical Story: [ARCH-12](https://issues.example.com/ARCH-12)

## Context and Problem Statement

We want to record the architectural decisions made in this project.
Which tool(s) should we use to manage these records?

## Considered Options

- [Log4brains](https://github.com/thomvaill/log4brains)
- Plain Markdown files

## Decision Outcome

Chosen option: "Log4brains", because it also builds a static site.
