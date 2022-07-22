const { fetchProjectByKey } = require("../projects");
const crypto = require("crypto");
const { AUTH_TYPE } = process.env

const resolveAuthSettings = async (req) => {
  const settings = {'role': 'anonymous'};

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
}

module.exports = resolveAuthSettings;
