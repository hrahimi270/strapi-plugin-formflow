---
"@formflowjs/strapi-plugin-formflow": patch
---

Add anonymous, opt-out usage telemetry so we can gauge active installs and prioritize work. A one-time install event plus a daily heartbeat report non-identifying data only (plugin/Strapi/Node versions, license tier, form count, an approximate country, and a hashed install id) — never form content, submissions, or secrets. Telemetry honors Strapi's own opt-out (`STRAPI_TELEMETRY_DISABLED`, removed project `uuid`) and a dedicated `FORMFLOW_TELEMETRY_DISABLED` env var, and never blocks startup.
