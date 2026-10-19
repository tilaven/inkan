/** Lowercase words of a team id, name or keyword: `payments-core`, "SecurityTools" → payments core, security tools. */
export const teamWords = (text: string) =>
  text
    .replace(/(?<![^A-Za-z0-9][a-z]|^[a-z])(?<=[a-z0-9])(?=[A-Z])/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Whether a team word and a keyword name the same thing, ignoring a plural `s` (payment, payments). */
export const sameWord = (word: string, keyword: string) => word === keyword || word === `${keyword}s` || keyword === `${word}s`;
