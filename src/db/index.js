const Knex = require('knex')
const knexConfig = require('./knexfile')

const knex = Knex(knexConfig[process.env.NODE_ENV])

const tables = {
  users: 'xtr_users',
  files: 'xtr_files',
  userFiles: 'xtr_user_files',
}

module.exports = { knex, tables }
