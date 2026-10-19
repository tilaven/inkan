import { t } from '../lib/i18n';
import { SearchUnavailableError } from './types';

export async function requestJson<T>(service: string, url: string, init: RequestInit, hint: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new SearchUnavailableError(t('search.unreachable', { service, hint }));
  }
  if (!response.ok) {
    throw new SearchUnavailableError(t('search.answered', { service, status: response.status, hint }));
  }
  return (await response.json()) as T;
}
