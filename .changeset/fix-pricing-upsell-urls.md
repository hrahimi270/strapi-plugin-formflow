---
'@formflowjs/strapi-plugin-formflow': patch
---

Point all upgrade/upsell links to the public website pricing page (`https://hrahimi270.github.io/formflow/#pricing`) instead of the placeholder `formflow.dev`. This updates the server 402 upgrade responses (form create/update, advanced export and other gated submission endpoints) and the admin upsell UI (the shared `PURCHASE_URL` used by `UpsellCard`, gated buttons, and the Pro field-type prompt). Also adds Website and Pricing links to the README.
