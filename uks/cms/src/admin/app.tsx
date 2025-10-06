import type { StrapiApp } from '@strapi/strapi/admin';
import { CMS_FAVICON_DATA_URI } from './base64';

export default {
  config: {
    head: {
      favicon: CMS_FAVICON_DATA_URI,
    },
  },
  bootstrap(_app: StrapiApp) {
    // no-op bootstrap retained for future admin customisation hooks
  },
};
