const { postgraphile, makePluginHook } = require('postgraphile')
const { DB_DATABASE, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT } = process.env

const SubscriptionPlugin = require("./subscriptions");
const NotificationPlugin = require("./notifications");
const { default: PgPubsub } = require("@graphile/pg-pubsub");
const resolveAuthSettings = require("./utils/auth");

const pluginHook = makePluginHook([PgPubsub]);

module.exports = postgraphile(
  {
    database: DB_DATABASE,
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    port: DB_PORT,
  },
  'public',
  {
    pgSettings: resolveAuthSettings,
    graphqlRoute: '/api/graphql',
    graphiqlRoute: '/api/graphiql',
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    // Subscriptions
    pluginHook,
    subscriptions: true,
    appendPlugins: [SubscriptionPlugin, NotificationPlugin],
    websocketMiddlewares: [
      (req, res, next) => {
        if (req.connectionParams['x-api-key']) {
          req.headers['x-api-key'] = req.connectionParams['x-api-key'];
        }
        if (req.connectionParams['x-user-id']) {
          req.headers['x-user-id'] = req.connectionParams['x-user-id'];
        }
        if (req.connectionParams['x-user-hmac']) {
          req.headers['x-user-hmac'] = req.connectionParams['x-user-hmac'];
        }
        next();
      }
    ]
  }
)
