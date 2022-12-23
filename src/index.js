const express = require('express')
const dotenv = require('dotenv')
const helmet = require('helmet')
const compression = require('compression')
const session = require('express-session')
const cors = require('cors')
const { knex } = require('./db')

const v1Router = require('./routes/v1')

dotenv.config()

const app = express()
const port = process.env.PORT || 8080

/**
 * @type {import('cors').CorsOptions}
 */
const costOpts = {
  origin: '*',
  optionsSuccessStatus: 204,
}

app.disable('x-powered-by')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors(costOpts))
app.use(helmet())
app.use(compression())
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
)

app.use('/api/v1', v1Router)
app.all('*', (_, res) => {
  res.sendStatus(404)
})

async function start() {
  try {
    knex
      .raw('select 1 as dbIsUp')
      .then(() => {
        console.log('Mysql server connected successfully')
      })
      .catch((e) => {
        console.log('Mysql server NOT connected!', e)
      })

    app.listen(port, () => {
      console.log(`App listening on port: ${port}`)
    })
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

start().then()
