const jwt = require('../utils/jwt')
const { knex, tables } = require('../db')

// eslint-disable-next-line consistent-return
module.exports = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next()
  }
  try {
    const token = req.headers.authorization.split(' ')[1] // "Bearer token"
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized access' })
    }
    const { error, payload } = await jwt.getPayloadAndVerify(token)
    if (error && error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ message: 'Token was expired' })
    }
    if (error && error.code === 'ERR_JWT_INVALID') {
      return res.status(401).json({ message: 'Token invalid' })
    }
    /**
     * @type {import('../types').I_USER}
     */
    const user = await knex(tables.users).where({ client_id: payload.client_id }).first()
    if (user && user.force_logout) {
      return res.status(401).json({ message: 'Token was expired' })
    }
    console.log({ user })
    req.user = user
    return next()
  } catch (e) {
    res.status(401).json({ message: 'Unauthorized access' })
  }
}
