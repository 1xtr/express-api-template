const jose = require('jose')
const dayjs = require('dayjs')

const ACCESS = 'access_token'
const REFRESH = 'refresh_token'

const signKey = {
  [ACCESS]: new TextEncoder().encode(process.env.ACCESS_TOKEN_KEY),
  [REFRESH]: new TextEncoder().encode(process.env.REFRESH_TOKEN_KEY),
}

const alg = 'HS256'

module.exports = {
  getToken: async (payload, type = ACCESS) => {
    const expiresIn = type === ACCESS ? dayjs().add(2, 'm').unix() : dayjs().add(1, 'M').unix()
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg })
      .setIssuedAt(dayjs().unix())
      .setIssuer('Auth Server')
      .setExpirationTime(expiresIn)
      .setSubject(ACCESS)
      .sign(signKey[type])
    return { token, expiresIn }
  },

  // eslint-disable-next-line consistent-return
  getPayloadAndVerify: async (token, type = ACCESS) => {
    try {
      const { payload } = await jose.jwtVerify(token, signKey[type])
      return { error: null, payload }
    } catch (error) {
      // console.log('jwtVerify error', error)
      return { error }
    }
  },
  access: ACCESS,
  refresh: REFRESH,
}
