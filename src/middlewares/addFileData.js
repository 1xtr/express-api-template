const { knex, tables } = require('../db')

// eslint-disable-next-line consistent-return
module.exports = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next()
  }
  const { id } = req.params
  if (Number.isNaN(Number(id))) {
    return res.status(400).json({ success: false, message: 'File id undefined' })
  }
  try {
    const file = await knex(tables.files).where({ id }).first()
    if (!file) {
      res.status(404).json({ success: false, message: 'File not found' })
    }
    req.file = file
    return next()
  } catch (e) {
    res.status(500).json({ success: false, message: 'File request failed' })
  }
}
