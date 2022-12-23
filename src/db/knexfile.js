module.exports = {
  development: {
    client: 'mysql',
    connection: {
      host: process.env.MYSQL_DB_HOST || 'localhost',
      database: process.env.MYSQL_DB_NAME,
      user: process.env.MYSQL_DB_USER,
      password: process.env.MYSQL_DB_PASS,
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  production: {
    client: 'mysql',
    connection: {
      host: process.env.MYSQL_DB_HOST || 'localhost',
      database: process.env.MYSQL_DB_NAME,
      user: process.env.MYSQL_DB_USER,
      password: process.env.MYSQL_DB_PASS,
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
}
