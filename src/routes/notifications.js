const express = require('express')
const { body } = require('express-validator');

const db = require('../db')
const resolveAuthSettings = require('../utils/auth')
const validate = require("../utils/validate");
const { fetchProjectByKey } = require("../projects");

const router = express.Router()

const auth = async function (req, res, next) {
  try {
    const settings = await resolveAuthSettings(req);

    if (settings.role !== 'system_user') {
      return res.status(403).json({ error: 'forbidden', message: `User ${settings['request.user_id']} doesn't have permission to create notifications` })
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
    body('type').notEmpty().withMessage('Field \'type\' is required and cannot be empty.'),
    body('recipient').notEmpty().withMessage('Field \'recipient\' is required and cannot be empty.'),
  ]),
  async (req, res) => {
    const { type, recipient, payload, action_url } = req.body
    const project = await fetchProjectByKey(req.headers['x-api-key'])
    const values = { type, payload, user_id: recipient, project_id: project.id, action_url };

    try {
      const notifications = await db('notifications').insert(values).returning('id')
      return res.status(201).json({ notifications })
    } catch(e) {
      console.error('Failed to create notification', e)
      return res.status(500).json({ error: 'internal_server_error', message: `An error occurred while creating new notification: ${e.message}` })
    }
})

module.exports = router
