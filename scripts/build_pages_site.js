#!/usr/bin/env node
/**
 * Wrapper entrypoint for building the GitHub Pages static site.
 *
 * `package.json` expects this file at `scripts/build_pages_site.js`.
 * The implementation lives in `administration/scripts/build_pages_site.js`.
 */

require('../administration/scripts/build_pages_site.js');

