import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkIssueLinks from './remark-issue-links.mjs';

type Rule = { pattern: string; url: string };

function run(markdown: string, rules?: Rule[]) {
  return String(unified().use(remarkParse).use(remarkIssueLinks, { rules }).use(remarkStringify).processSync(markdown)).trim();
}

const jira: Rule = { pattern: 'PAY-(\\d+)', url: 'https://tracker.example/browse/PAY-$1' };

describe('remark-issue-links', () => {
  it('links issue keys using capture groups', () => {
    expect(run('See PAY-123 and PAY-7.', [jira])).toBe(
      'See [PAY-123](https://tracker.example/browse/PAY-123) and [PAY-7](https://tracker.example/browse/PAY-7).',
    );
  });

  it('does nothing without rules', () => {
    expect(run('See PAY-123.')).toBe('See PAY-123.');
  });

  it('does not touch text that is already a link', () => {
    expect(run('[PAY-1](https://x.test)', [jira])).toBe('[PAY-1](https://x.test)');
  });

  it('supports several rules in document order', () => {
    const gh: Rule = { pattern: '#(\\d+)', url: 'https://github.com/o/r/issues/$1' };
    expect(run('#5 then PAY-9', [jira, gh])).toBe(
      '[#5](https://github.com/o/r/issues/5) then [PAY-9](https://tracker.example/browse/PAY-9)',
    );
  });

  it('does not link inside code', () => {
    expect(run('`PAY-1`', [jira])).toBe('`PAY-1`');
  });
});
