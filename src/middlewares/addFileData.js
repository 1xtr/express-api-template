const { knex, tables } = require('../db')

// eslint-disable-next-line consistent-return
module.exports = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next()
  }
  const { id } = req.params
  if (Number.isNaN(id)) {
    return res.status(400).json({ success: false, message: 'File id undefined' })
  }
  try {
    const file = await knex(tables.files).where({ id }).select('id', 'path').first()
    if (!file) {
      res.status(404).json({ message: 'File not found' })
    }
    req.file = file
    return next()
  } catch (e) {
    res.status(500).json({ message: 'File request failed' })
  }
}
