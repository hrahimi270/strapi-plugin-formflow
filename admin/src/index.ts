import { Shield } from '@strapi/icons';

import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { PERMISSIONS } from './permissions';

import './ee'; // side-effect import to prevent tree-shake of ee/ barrel

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: getTranslation('plugin.name'),
        defaultMessage: 'FormFlow',
      },
      // Only show the menu entry to roles granted at least form-read. The page
      // itself is also wrapped in <Page.Protect> for defense in depth.
      permissions: PERMISSIONS.main,
      Component: async () => {
        const { App } = await import('./pages/App');

        return App;
      },
    });

    // GDPR Compliance (Business). The route is mounted under the plugin app
    // shell; this is its visible entry point. Visibility is gated by the same
    // plugin-access permission (form read) so it appears to roles that can use
    // the plugin — the CompliancePage itself is license-aware and renders the
    // Business upsell when the tier is not entitled (display-only gate; the
    // server endpoints are the authoritative 402 gate).
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/compliance`,
      icon: Shield,
      intlLabel: {
        id: getTranslation('compliance.menu.label'),
        defaultMessage: 'Compliance',
      },
      permissions: PERMISSIONS.main,
      Component: async () => {
        const { App } = await import('./pages/App');

        return App;
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
