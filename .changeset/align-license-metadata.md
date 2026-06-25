---
'@formflowjs/strapi-plugin-formflow': patch
---

Align open-core licensing metadata with Strapi's convention. Declare `"license": "SEE LICENSE IN LICENSE"` in `package.json` (instead of `"MIT"`, which understated the dual-licensed `ee/` code), matching how `@strapi/*` packages do it, and replace the README's auto MIT badge with an honest "Open Core (MIT + EE)" badge. No change to the actual terms — the free core stays MIT and `ee/` stays under `LICENSE-EE` per the root `LICENSE` carve-out.
