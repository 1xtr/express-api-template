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
    // проверка, есть ли у пользователя данный файл
    const isValidPermissions = await knex(tables.userFiles)
      .where({ file_id: id })
      .where({ user_id: req.user.id })
      .first()
    // добавим в поиск исключение для метода PUT при обновлении файла
    if (isValidPermissions || (req.method === 'PUT' && req.url.includes('/update/'))) {
      const file = await knex(tables.files).where({ id }).first()
      if (!file) {
        res.status(404).json({ success: false, message: 'File not found' })
      }
      req.file = file
      return next()
    }
    // вернем ответ, что не верный запрос, не сообщая о существовании файла с кодом 403
    res.status(400).json({ success: false, message: 'File not found' })
  } catch (e) {
    res.status(500).json({ success: false, message: 'File request failed' })
  }
}
