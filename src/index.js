require('dotenv').config()
const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const postgraphile = require('./postgraphile')
const { checkJwt, handleAuthExceptions } = require('./auth')
const notifications = require('./routes/notifications')

const { PORT, AUTH_TYPE } = process.env

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

if ('jwt' === AUTH_TYPE) {
  // Apply JWT verification and error handling to the graphql endpoint
  app.use("/api/graphql", checkJwt);
  app.use("/api/graphql", handleAuthExceptions);
}

app.use(postgraphile);

app.use("/api/notifications", notifications)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
