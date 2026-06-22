/**
 * Application methods
 */
import bootstrap from './bootstrap';
import destroy from './destroy';
import register from './register';

/**
 * Plugin server methods
 */
import config from './config';
import contentTypes from './content-types';
import controllers from './controllers';
import middlewares from './middlewares';
import policies from './policies';
import routes from './routes';
import services from './services';

import './ee'; // side-effect import to prevent tree-shake of ee/ barrel

export default {
  register,
  bootstrap,
  destroy,
  config,
  controllers,
  routes,
  services,
  contentTypes,
  policies,
  middlewares,
};
