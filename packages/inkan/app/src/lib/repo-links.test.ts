import { describe, expect, it } from 'vitest';
import { editFileUrl, newRecordUrl } from './repo-links';

const repo = (provider: 'github' | 'gitlab' | 'gitea', url: string) => ({ url, branch: 'main', provider });

describe('editFileUrl', () => {
  it('uses each host\'s editor path', () => {
    expect(editFileUrl(repo('github', 'https://github.com/acme/x'), 'decisions/a b.md')).toBe('https://github.com/acme/x/edit/main/decisions/a%20b.md');
    expect(editFileUrl(repo('gitlab', 'https://gitlab.com/acme/x'), 'decisions/a.md')).toBe('https://gitlab.com/acme/x/-/edit/main/decisions/a.md');
    expect(editFileUrl(repo('gitea', 'https://codeberg.org/acme/x'), 'decisions/a b.md')).toBe('https://codeberg.org/acme/x/_edit/main/decisions/a%20b.md');
  });
});

describe('newRecordUrl', () => {
  it('prefills what each host supports', () => {
    expect(newRecordUrl(repo('github', 'https://github.com/acme/x'), 'decisions/p/adr', '0001-a.md', '# A')).toBe(
      'https://github.com/acme/x/new/main/decisions/p/adr?filename=0001-a.md&value=%23%20A',
    );
    expect(newRecordUrl(repo('gitlab', 'https://gitlab.com/acme/x'), 'decisions/p/adr', '0001-a.md', '# A')).toBe(
      'https://gitlab.com/acme/x/-/new/main/decisions/p/adr?file_name=0001-a.md',
    );
    expect(newRecordUrl(repo('gitea', 'https://codeberg.org/acme/x'), 'decisions/p/adr', '0001-a.md', '# A')).toBe(
      'https://codeberg.org/acme/x/_new/main/decisions/p/adr',
    );
  });
});
