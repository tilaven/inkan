import type { InkanPlugin } from './index';

export interface AnalyticsOptions {
  /** https://plausible.io, or your own instance through `src`. */
  plausible?: {
    /** The site's domain as registered in Plausible, e.g. 'decisions.acme.dev'. */
    domain: string;
    /** Script URL. Default: 'https://plausible.io/js/script.js'. */
    src?: string;
    /** Event endpoint when proxied through your own domain, e.g. '/stats/api/event'. */
    api?: string;
  };
  /** https://umami.is, Umami Cloud or self-hosted. */
  umami?: {
    websiteId: string;
    /** Script URL. Default: 'https://cloud.umami.is/script.js'. */
    src?: string;
    /** Where events are sent when it differs from the script's origin. */
    hostUrl?: string;
    /** Only track on these hostnames, e.g. ['decisions.acme.dev']. */
    domains?: string[];
  };
  /** Google Analytics 4. */
  google?: {
    /** e.g. 'G-XXXXXXXXXX'. */
    measurementId: string;
  };
  /** Send site events (search queries, page actions) besides page views. Default: true. */
  events?: boolean;
  /** Load the scripts in `inkan dev` too. Default: false. */
  dev?: boolean;
}

/** Plugin that adds Plausible, Umami and/or Google Analytics 4 to every page. */
export declare function analytics(options: AnalyticsOptions): InkanPlugin;
