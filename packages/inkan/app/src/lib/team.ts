import type { DocEntry } from './decisions';

const INTRO = /^([^/]+)\/(index|readme)$/;

/** The project a `<project>/index.md` or `<project>/README.md` file is the intro of. */
export const introOf = (id: string) => INTRO.exec(id)?.[1];

/** Intro page of a project: `index` wins over `README`. */
export function findIntro(docs: DocEntry[], project: string) {
  return docs.find((d) => d.id === `${project}/index`) ?? docs.find((d) => d.id === `${project}/readme`);
}
