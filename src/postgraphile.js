const { postgraphile, makePluginHook } = require('postgraphile')
const crypto = require('crypto')
const { DB_DATABASE, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, AUTH_TYPE, AUTH_USER_CLAIM } = process.env

const SubscriptionPlugin = require("./subscriptions");
const NotificationPlugin = require("./notifications");
const { fetchProjectByKey } = require("./projects");
const { default: PgPubsub } = require("@graphile/pg-pubsub");

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
      async pgSettings(req) {
        const settings = {};

        settings['role'] = 'anonymous';

        // Verify required headers
        if (!req.headers) {
          throw new Error('Missing headers in request');
        }
        if (!req.headers['x-api-key']) {
          throw new Error(`Missing required header 'x-api-key'`);
        }
        if (!req.headers['x-user-id']) {
          throw new Error(`Missing required header 'x-user-id'`);
        }

        // Fetch api-secret-key using public key
        const apiPublicKey = req.headers['x-api-key']
        const userId = req.headers['x-user-id']
        const project = await fetchProjectByKey(apiPublicKey)

        if (!project || !project.api_secret_key) {
          throw new Error(`Failed to authenticate using '${apiPublicKey}' api key`);
        }

        const apiSecretKey = project.api_secret_key;
        const projectId = project.id;


        if ('hmac' === AUTH_TYPE) {
          // HMAC-based authentication
          // Read more at https://notifir.github.io/docs/integration/authentication

          if (!req.headers['x-user-hmac']) {
            throw new Error(`Missing required header 'x-user-hmac'`);
          }

          // Verify HMAC

          const userHmac = req.headers['x-user-hmac'];

          const calculatedUserHmac = crypto
            .createHmac('sha256', apiSecretKey)
            .update(userId)
            .digest('base64');

          if (userHmac !== calculatedUserHmac) {
            console.warn(`HMAC verification failed: ${userHmac} !== ${calculatedUserHmac}`);
            throw new Error(`Failed to authenticate '${userId}': HMAC mismatch`);
          }
        }

        // Set DB-level roles and attributes
        settings['role'] = ('system' === userId) ? 'system_user' : 'simple_user';
        settings['request.user_id'] = userId;
        settings['request.project_id'] = projectId;

        return settings;
      },
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
          if (req.connectionParams['authorization-key']) {
            req.headers['authorization-key'] = req.connectionParams['authorization-key'];
          }
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
