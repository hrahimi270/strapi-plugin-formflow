---
'@formflowjs/strapi-plugin-formflow': patch
---

Widen peerDependencies so the plugin installs on any Strapi v5 (`>=5.0.0`) instead of only `5.33+`. Loosen `@strapi/design-system`, `@strapi/icons`, `react`, `react-dom`, `react-router-dom`, and `styled-components` ranges to accept what any Strapi v5 host ships, and drop the build-only `@strapi/sdk-plugin` from peers (it is never imported at runtime). Fixes `npm install` ERESOLVE errors on Strapi 5.0–5.32.
