const { body } = require('express-validator')
const { knex, tables } = require('../db')

exports.registrationValidate = [
  body('email')
    .isEmail()
    .withMessage('Input correct E-mail')
    .custom(async (value) => {
      try {
        const candidate = await knex(tables.users).where({ email: value })
        if (candidate) {
          // eslint-disable-next-line prefer-promise-reject-errors
          return Promise.reject('User with this email already exist')
        }
      } catch (e) {
        console.log(e)
      }
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject('Can not validate email now')
    })
    .normalizeEmail(),
  body('password', 'Password most be min 6 symbols with numbers and letters')
    .isLength({
      min: 6,
      max: 25,
    })
    .isAlphanumeric()
    .trim(),
  body('confirm')
    .custom((value, { req }) => {
      if (!value !== req.body.password) {
        throw new Error('Passwords not equals')
      }
      return true
    })
    .trim(),
]
