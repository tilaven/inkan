/** `1 record`, `3 records`: a count with a regular English noun, for CLI output. */
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
