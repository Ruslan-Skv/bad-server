import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'
import BadRequestError from '../errors/bad-request-error'

const uploadRouter = Router()
// uploadRouter.post('/', fileMiddleware.single('file'), uploadFile)

uploadRouter.post('/', (req, res, next) => {
    console.log('Upload request received')
    
    fileMiddleware.single('file')(req, res, (err) => {
        if (err) {
            console.log('Multer error:', err)
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(new BadRequestError('Файл слишком большой'))
            }
            return next(new BadRequestError('Ошибка загрузки файла: ' + err.message))
        }
        
        if (!req.file) {
            console.log('No file in request')
            return next(new BadRequestError('Файл не загружен'))
        }
        
        console.log('File processed by multer:', req.file.originalname)
        next()
    })
}, uploadFile)

export default uploadRouter
