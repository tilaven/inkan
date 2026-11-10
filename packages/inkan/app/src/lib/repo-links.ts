export type RepoProvider = 'github' | 'gitlab' | 'gitea';

interface Repo {
  url: string;
  branch: string;
  provider: RepoProvider;
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/** Link that opens the host's web editor on an existing file. */
export function editFileUrl(repo: Repo, file: string) {
  const editor = repo.provider === 'gitlab' ? '-/edit' : repo.provider === 'gitea' ? '_edit' : 'edit';
  return `${repo.url}/${editor}/${repo.branch}/${encodePath(file)}`;
}

/**
 * Link that opens the host's web editor with a new record: GitHub fills name and content, GitLab the file name,
 * Gitea and Forgejo links are not prefilled and open the folder's new-file page.
 */
export function newRecordUrl(repo: Repo, dir: string, fileName: string, content: string) {
  const folder = encodePath(dir);
  if (repo.provider === 'gitlab') return `${repo.url}/-/new/${repo.branch}/${folder}?file_name=${encodeURIComponent(fileName)}`;
  if (repo.provider === 'gitea') return `${repo.url}/_new/${repo.branch}/${folder}`;
  return `${repo.url}/new/${repo.branch}/${folder}?filename=${encodeURIComponent(fileName)}&value=${encodeURIComponent(content)}`;
}
