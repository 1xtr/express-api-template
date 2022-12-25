const { knex, tables } = require('../db')

// eslint-disable-next-line consistent-return
module.exports = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next()
  }
  try {
    // запросим все файлы пользователя
    const userFileList = await knex(tables.userFiles)
      .where({ user_id: req.user.id })
      .select('file_id')
    // console.log({ userFileList })
    if (Array.isArray(userFileList) && userFileList.length > 0) {
      req.userFileIds = userFileList.map(({ file_id: fileId }) => fileId)
    }
    return next()
  } catch (e) {
    res.status(500).json({ success: false, message: 'File list request failed' })
  }
}
