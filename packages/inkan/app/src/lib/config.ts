/** The user's resolved inkan.config, as typed values for the pages. */
import config from 'virtual:inkan/config';

export const site = config;
export const docTypes = config.docTypes;
export const statuses = config.statuses;
export const openStatuses = Object.keys(config.statuses).filter((s) => config.statuses[s].open);
export const currentStatuses = Object.keys(config.statuses).filter((s) => config.statuses[s].current);
export type DocType = string;
export type Status = string;
