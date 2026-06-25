# @formflowjs/strapi-plugin-formflow

## 1.0.5

### Patch Changes

- c7ceb8e: Correct the website and pricing links to the renamed GitHub Pages path (`https://hrahimi270.github.io/formflow/#pricing`) after the public site repo was renamed from `formflow-website` to `formflow`. Updates the server 402 upgrade responses, the admin upsell UI (the shared `PURCHASE_URL`), and the README links.

## 1.0.4

### Patch Changes

- 37d8d68: Point all upgrade/upsell links to the public website pricing page (`https://hrahimi270.github.io/formflow-website/#pricing`) instead of the placeholder `formflow.dev`. This updates the server 402 upgrade responses (form create/update, advanced export and other gated submission endpoints) and the admin upsell UI (the shared `PURCHASE_URL` used by `UpsellCard`, gated buttons, and the Pro field-type prompt). Also adds Website and Pricing links to the README.

## 1.0.3

### Patch Changes

- 408e073: Set the real copyright holder and licensing contact (Bardiya Rahimi <hrahimi270@gmail.com>) in LICENSE, LICENSE-EE, and the package.json author field.

## 1.0.2

### Patch Changes

- af8dc32: Widen peerDependencies so the plugin installs on any Strapi v5 (`>=5.0.0`) instead of only `5.33+`. Loosen `@strapi/design-system`, `@strapi/icons`, `react`, `react-dom`, `react-router-dom`, and `styled-components` ranges to accept what any Strapi v5 host ships, and drop the build-only `@strapi/sdk-plugin` from peers (it is never imported at runtime). Fixes `npm install` ERESOLVE errors on Strapi 5.0–5.32.

## 1.0.1

### Patch Changes

- 8f71e10: Harden licensing
