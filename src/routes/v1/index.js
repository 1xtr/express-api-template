const { Router } = require('express')
const authRouter = require('./auth')
const userRouter = require('./user')
const fileRouter = require('./file')

const router = Router()

router.use('/auth', authRouter)
router.use('/user', userRouter)
router.use('/file', fileRouter)

module.exports = router
