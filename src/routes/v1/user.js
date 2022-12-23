const { Router } = require('express')
const authMiddleware = require('../../middlewares/auth.mw')
const { knex, tables } = require('../../db')

const router = Router()

router.use(authMiddleware)
router.get('/info', (req, res) => {
  console.log({ reqUser: req.user })
  res.status(200).json({ success: true, client_id: req.user.client_id })
})

router.get('/logout', async (req, res) => {
  const { user } = req
  console.log('logout', user)
  const updateResult = await knex(tables.users).where({ client_id: user.client_id }).update({
    force_logout: 1,
  })
  console.log({ updateResult })
  res.status(200).json({ success: true, message: 'Logged out successfully' })
})

module.exports = router
