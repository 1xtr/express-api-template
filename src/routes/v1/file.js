const { extname, normalize, join } = require('path')
const { omit } = require('lodash')
const dayjs = require('dayjs')
const fileUpload = require('express-fileupload')
const { Router } = require('express')
const { unlink } = require('fs/promises')
const authMiddleware = require('../../middlewares/auth')
const addFileDataMiddleware = require('../../middlewares/addFileData')
const { knex, tables } = require('../../db')

const router = Router()
const TEMP_DIR = '../../../tmp/'
const UPLOAD_DIR = '../../../upload'
const fileUploadOptions = {
  // Limit 1Mb
  limits: 1024 * 1024,
  useTempFiles: true,
  tempFileDir: TEMP_DIR,
  abortOnLimit: true,
  debug: false,
}

router.use(authMiddleware)

// eslint-disable-next-line consistent-return
router.post('/upload', fileUpload(fileUploadOptions), async (req, res) => {
  // console.log({ user: req.user })
  // если объект с файлами пустой, то выходим
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ success: false, message: 'No files were uploaded.' })
  }
  // Подразумеваем что поле с файлом имеет имя file
  const { file: uploadedFile } = req.files

  // Создадим объект с данными для базы
  const newFile = {
    name: uploadedFile.name,
    extension: extname(uploadedFile.name).substring(1),
    mimetype: uploadedFile.mimetype,
    size: uploadedFile.size,
    upload_date: dayjs().unix(),
    uploader_id: req.user.id,
    md5: uploadedFile.md5,
    path: normalize(join(__dirname, UPLOAD_DIR, uploadedFile.md5)),
  }
  // console.log({ newFile })
  // проверим, загружали ли ранее такой файл
  const existedFile = await knex(tables.files).where({ md5: uploadedFile.md5 }).first()
  // console.log({ existedFile })
  if (existedFile) {
    // если нашли файл, то проверим если такой файл у пользователя
    const newRow = {
      user_id: req.user.id,
      file_id: existedFile.id,
    }
    const isUserAlreadyHasFile = await knex(tables.userFiles).where(newRow).first()
    // если файл не привязан к пользователю, то добавим связку
    if (!isUserAlreadyHasFile) {
      await knex(tables.userFiles).insert(newRow)
    }
    return res.status(200).json({ success: true, message: `File ${newFile.name} uploaded!` })
  }

  // console.log({ newFilePath })
  uploadedFile.mv(newFile.path, async (err) => {
    if (err) {
      return res.status(500).json(err)
    }
    try {
      // добавим в базу информацию о файле
      const newFileId = await knex(tables.files).insert(newFile)
      // сохраним связь пользователя с файлом
      await knex(tables.userFiles).insert({ user_id: req.user.id, file_id: newFileId })
    } catch (e) {
      console.log(e)
    }
    return res.status(200).json({ success: true, message: `File ${newFile.name} uploaded!` })
  })
})
router.get('/list', async (req, res) => {
  res.sendStatus(200)
})
// eslint-disable-next-line consistent-return
router.delete('/delete/:id', addFileDataMiddleware, async (req, res) => {
  const { file, user } = req
  /*
  Проверим, есть ли у кого-то в списке такой же файл,
  если нет, то удалим файл, и связь.
  Если есть, то удалим только связь
  */
  const anotherOwner = await knex(tables.userFiles)
    .where({ file_id: file.id })
    .whereNot({ user_id: user.id })
    .select('user_id')
    .first()
  // console.log({ anotherOwner })
  // удалим связь файла и пользователя
  await knex(tables.userFiles).where({ user_id: user.id, file_id: file.id }).delete()
  if (!anotherOwner) {
    // если больше ни у кого файл не привязан, то удалим и сам файл, и запись в базе
    // вначале получим путь до файла
    try {
      await unlink(normalize(file.path))
      await knex(tables.files).where({ id: file.id }).delete()
    } catch (err) {
      console.log('File delete error', err)
      return res.status(500).send('Delete file failed')
    }
  }
  res.status(200).json({ success: true, message: 'File successfully deleted' })
})
router.get('/:id', addFileDataMiddleware, (req, res) => {
  const { file } = req
  res.json(omit(file, 'uploader_id', 'path', 'md5'))
})
router.get('/download/:id')
router.put('/update/:id')
router.all('*', (_, res) => {
  res.sendStatus(404)
})

module.exports = router
