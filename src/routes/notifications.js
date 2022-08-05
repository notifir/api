const express = require('express')
const { body } = require('express-validator');

const { db, pgp } = require('../db')
const resolveAuthSettings = require('../utils/auth')
const validate = require("../utils/validate");
const { fetchProjectByKey } = require("../projects");

const requiredMessage = 'This field is required and cannot be empty.';

const router = express.Router()

const auth = async function (req, res, next) {
  try {
    const settings = await resolveAuthSettings(req);

    if (settings.role !== 'system_user') {
      return res.status(403).json({ error: 'unauthorized', message: `User ${settings['request.user_id']} doesn't have permission to create notifications` })
    }

    return next();
  } catch (err) {
    console.error(err)
    return res.status(401).json({ error: 'unauthorized', message: err.message })
  }
}

router.use(auth)

router.post('/',
  validate([
    body('type').notEmpty().withMessage(requiredMessage),
    body('payload').isObject().notEmpty().withMessage(requiredMessage),
    body('recipients').isArray({ min: 1 }).withMessage(requiredMessage),
  ]),
  async (req, res) => {
    const { type, recipients, payload, action_url } = req.body
    const project = await fetchProjectByKey(req.headers['x-api-key'])

    const cs = new pgp.helpers.ColumnSet(['type', 'payload', 'user_id', 'project_id', 'action_url'], { table: 'notifications' });
    const values = recipients.map(recipient => ({ type, payload, user_id: recipient, project_id: project.id, action_url }));
    const query = pgp.helpers.insert(values, cs) + ' returning id';

    try {
      const notifications = await db.many(query);
      return res.status(201).json({ notifications })
    } catch(e) {
      console.error('Failed to create notifications', e)
      return res.status(500).json({ error: 'internal_server_error', message: `An error occurred while creating new notification: ${e.message}` })
    }
})

module.exports = router
