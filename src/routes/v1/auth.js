const dayjs = require('dayjs')
const { Router } = require('express')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const jwt = require('../../utils/jwt')
const { knex, tables } = require('../../db')

// Valid 10 minutes
const ACCESS_TOKEN_VALID_TIME = 60 * 10
// Valid 1 month
// const REFRESH_TOKEN_VALID_TIME = 60 * 60 * 24 * 31

const router = Router()

router.post('/signup', async (req, res) => {
  console.log('auth', req.body)
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: 'Email or password not be empty' })
  }
  // TODO: email & password validation
  try {
    const candidate = await knex(tables.users).where({ email }).first()
    // console.log({ candidate })
    if (candidate) {
      return res.status(409).json({ message: 'Email address already taken' })
    }
    // res.json(candidate)
    const salt = bcrypt.genSaltSync(10)
    const hashPassword = await bcrypt.hashSync(password, salt)

    const now = dayjs().unix()
    const clientId = uuidv4(undefined, undefined, undefined)
    const tokenPayload = {
      client_id: clientId,
      email,
    }
    const { token: accessToken, expiresIn: accessTokenExpIn } = await jwt.getToken(tokenPayload)
    const { token: refreshToken, expiresIn: refreshTokenExpIn } = await jwt.getToken(
      tokenPayload,
      jwt.refresh
    )
    const newUser = {
      email,
      password: hashPassword,
      registration_date: now,
      last_login_date: now,
      client_id: clientId,
      access_token: accessToken,
      refresh_token: refreshToken,
      a_token_valid_till: accessTokenExpIn,
      r_token_valid_till: refreshTokenExpIn,
    }
    console.log({ newUser })
    // return created user id
    await knex(tables.users).insert(newUser)
    // res.redirect('/auth/login#login')
    return res.status(200).json({
      message: 'User created successfully',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_VALID_TIME,
    })
  } catch (e) {
    console.log(e)
  }
  return res.status(500).send({ message: 'Something went wrong' })
})

// eslint-disable-next-line consistent-return
router.post('/signin', async (req, res) => {
  const { email, password } = req.body
  // если не передан email or password то выходим
  if (!email || !password) {
    return res.status(400).json({ message: 'Email or password not be empty' })
  }
  // запросим пользователя по email
  const user = await knex(tables.users).where({ email }).first()
  const isPassValid = await bcrypt.compare(password, user.password)
  if (!isPassValid) {
    return res.status(401).json({ message: 'Email or password is incorrect' })
  }
  // console.log({ user })
  const tokenPayload = {
    client_id: user.client_id,
    email: user.email,
  }
  const { token: accessToken, expiresIn: accessTokenExpIn } = await jwt.getToken(tokenPayload)
  const { token: refreshToken, expiresIn: refreshTokenExpIn } = await jwt.getToken(
    tokenPayload,
    jwt.refresh
  )
  const newUserData = {
    last_login_date: dayjs().unix(),
    access_token: accessToken,
    refresh_token: refreshToken,
    a_token_valid_till: accessTokenExpIn,
    r_token_valid_till: refreshTokenExpIn,
    force_logout: 0,
  }
  console.log({ newUserData })
  const updateRes = await knex(tables.users).where({ id: user.id }).update(newUserData)
  console.log({ updateRes })
  res.status(200).json({
    message: 'Authorization successful',
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_VALID_TIME,
  })
})

router.post('/new-token', async (req, res) => {
  const { refresh_token: oldRefreshToken } = req.body
  const { error, payload } = await jwt.getPayloadAndVerify(oldRefreshToken, jwt.refresh)

  if (error) {
    return res.status(401).json({ message: 'Token invalid' })
  }

  const { token: accessToken, expiresIn: accessTokenExpIn } = await jwt.getToken(payload)
  const { token: refreshToken, expiresIn: refreshTokenExpIn } = await jwt.getToken(
    payload,
    jwt.refresh
  )

  const newUserData = {
    last_login_date: dayjs().unix(),
    access_token: accessToken,
    refresh_token: refreshToken,
    a_token_valid_till: accessTokenExpIn,
    r_token_valid_till: refreshTokenExpIn,
    force_logout: 0,
  }

  await knex(tables.users).where({ client_id: payload.client_id }).update(newUserData)

  return res.status(200).json({
    message: 'Token updated successful',
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_VALID_TIME,
  })
})

module.exports = router
