const { extname, normalize, join } = require('path')
const { omit, chunk } = require('lodash')
const dayjs = require('dayjs')
const fileUpload = require('express-fileupload')
const { Router } = require('express')
const { unlink } = require('fs/promises')
const authMiddleware = require('../../middlewares/auth')
const addFileDataMiddleware = require('../../middlewares/addFileData')
const userFileListMiddleware = require('../../middlewares/userFileList')
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
  // safeFileNames: true,
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
// eslint-disable-next-line consistent-return
router.get('/list', userFileListMiddleware, async (req, res) => {
  const { userFileIds } = req
  if (!userFileIds) {
    return res.sendStatus(204)
  }
  // eslint-disable-next-line prefer-const
  let { page = 1, limit = 10 } = req.query
  if (limit > 50) {
    limit = 50
  }
  const fileIdsChunked = chunk(userFileIds, limit)
  if (page > fileIdsChunked.length) {
    return res.sendStatus(204)
  }
  const fileList = await knex(tables.files).whereIn('id', fileIdsChunked[page - 1])
  const hasNext = fileIdsChunked.length > page
  res.json({
    page,
    hasNext,
    total: userFileIds.length,
    files: fileList.map((o) => omit(o, 'uploader_id', 'path', 'md5', 'upload_date')),
  })
})
// eslint-disable-next-line consistent-return
router.delete('/delete/:id', addFileDataMiddleware, async (req, res) => {
  const { file, user } = req
  /*
   * Проверим, есть ли у кого-то в списке такой же файл, если нет, то удалим файл, и связь.
   * Если есть, то удалим только связь
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
router.get('/download/:id', addFileDataMiddleware, (req, res) => {
  const { file } = req
  res.download(normalize(file.path), file.name, (err) => {
    if (err) {
      console.log('Send file error', err)
    } else {
      console.log(`File ${file.name} send success`)
    }
  })
})
router.put(
  '/update/:id',
  fileUpload(fileUploadOptions),
  addFileDataMiddleware,
  // eslint-disable-next-line consistent-return
  async (req, res) => {
    /*
     * 1. Вариант: у старого файла нет привязки к другим пользователям, новый файл не загружался ранее
     * сохраняем новый файл, удаляем старый. Связи не трогаем.
     * 2. Вариант: у старого файла нет привязки к другим пользователям, новый файл загружался ранее
     * новый не сохраняем, удаляем старый. Связи обновляем.
     * 3. Вариант: у старого файла есть привязки к другим пользователям, новый файл не загружался ранее
     * сохраняем новый файл, старый не трогаем. Обновим связи.
     * 4. Вариант: у старого файла есть привязки к другим пользователям, новый файл загружен ранее
     * новый не сохраняем, старый не удаляем, обновим связи.
     * */
    // если объект с файлами пустой, то выходим
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No files were uploaded.' })
    }
    const { file: oldFile, user } = req
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

    try {
      // проверим, загружали ли ранее такой файл
      const existedFile = await knex(tables.files).where({ md5: uploadedFile.md5 }).first()
      if (existedFile) {
        // если файл был загружен ранее, тогда добавим новую связь пользователя с файлом, удалив предыдущую
        await knex(tables.userFiles)
          .where({ user_id: req.user.id, file_id: oldFile.id })
          .update({ user_id: req.user.id, file_id: existedFile.id })
        // проверим привязку старого файла
        const anotherOwner = await knex(tables.userFiles)
          .where({ file_id: oldFile.id })
          .whereNot({ user_id: user.id })
          .select('user_id')
          .first()
        if (!anotherOwner) {
          // если связи нет удалим старый файл
          await unlink(normalize(oldFile.path))
          await knex(tables.files).where({ id: oldFile.id }).delete()
        }
        return res.status(200).json({
          success: true,
          message: `File ${newFile.name} updated! New file id: ${existedFile.id}`,
        })
      }
      // загрузим новый файл
      uploadedFile.mv(newFile.path, async (err) => {
        if (err) {
          return res.status(500).json(err)
        }
        try {
          /*
          Проверим, есть ли у кого-то в списке старый файл,
          если нет, то обновим информацию в базе и удалим старый файл.
          Если есть, то сохраним новый файл и вернем новый id
          */
          const anotherOwner = await knex(tables.userFiles)
            .where({ file_id: oldFile.id })
            .whereNot({ user_id: user.id })
            .select('user_id')
            .first()

          if (anotherOwner) {
            // есть такой файл у другого пользователя, старый оставляем
            // добавим в базу информацию о новом файле
            const newFileId = await knex(tables.files).insert(newFile)
            // заменим связь старого файла с пользователем на новый
            await knex(tables.userFiles)
              .where({ user_id: req.user.id, file_id: oldFile.id })
              .update({ user_id: req.user.id, file_id: newFileId })
            return res.status(200).json({
              success: true,
              message: `File ${newFile.name} updated! New file id: ${newFileId}`,
            })
          }
          // обновим в базе информацию о файле
          await knex(tables.files).where({ id: oldFile.id }).update(newFile)
          // удалим старый файл
          await unlink(normalize(oldFile.path))
        } catch (e) {
          console.log(e)
        }
        return res.status(200).json({ success: true, message: `File ${newFile.name} updated!` })
      })
    } catch (e) {
      console.log(e)
    }
  }
)
router.all('*', (_, res) => {
  res.sendStatus(404)
})

module.exports = router
