const express = require('express')
const { body } = require('express-validator');

const db = require('../db')
const resolveAuthSettings = require('../utils/auth')
const validate = require("../utils/validate");

const requiredMessage = 'This field is required and cannot be empty.';

const router = express.Router()

const auth = async function (req, res, next) {
  try {
    const settings = await resolveAuthSettings(req);

    if (settings.role !== 'system_user') {
      return res.status(403).json({ errors: [`User ${settings['request.user_id']} doesn't have permission to create notifications`] });
    }

    if (settings['request.project_id'] !== req.body['project_id']) {
      return res.status(403).json({ errors: [
        `User ${settings['request.user_id']} doesn't have permission to create notifications in project ${req.body['project_id']}`]
      });
    }

    return next();
  } catch (err) {
    console.error(err)
    return res.status(401).json({ errors: [err.message] });
  }
}

router.use(auth)

router.post('/',
  validate([
    body('type').notEmpty().withMessage(requiredMessage),
    body('user_id').notEmpty().withMessage(requiredMessage),
    body('project_id').notEmpty().withMessage(requiredMessage),
    body('payload').isObject().notEmpty().withMessage(requiredMessage),
  ]),
  async (req, res) => {
    const { type, user_id, project_id, payload } = req.body

    try {
      const query = 'INSERT INTO notifications(type, payload, user_id, project_id) VALUES ($1, $2, $3, $4) returning *';
      const result = await db.query(query, [type, payload, user_id, project_id])

      return res.status(201).json({ notification: { id: result[0].id } })
    } catch (e) {
      console.error(`Failed to create notification ${e}`)
      return res.status(500).json({errors: ["An error occurred while creating new notification"] })
    }
})

module.exports = router
