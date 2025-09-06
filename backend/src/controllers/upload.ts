import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import BadRequestError from '../errors/bad-request-error'
import sharp from 'sharp'

export const fileSizeLimits = {
    minFileSize: 2 * 1024,
    maxFileSize: 10 * 1024 * 1024, // 10 MB
}

// Middleware для обработки загрузки файлов
export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Проверяем, был ли загружен файл
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }

        if (req.file.size < fileSizeLimits.minFileSize) {
        return next(new BadRequestError('Файл слишком маленький (менее 2KB)'))
    }

    try {
        await sharp(req.file.path).metadata() // Если не изображение — упадёт ошибка
    } catch (error) {
        return next(new BadRequestError('Неверный формат изображения'))
    }

    try {
        // Формируем путь к загруженному файлу
        const fileName = process.env.UPLOAD_PATH_TEMP
            ? `/${process.env.UPLOAD_PATH_TEMP}/${req.file.filename}` // Если указан путь в env
            : `/${req.file?.filename}` // Если путь не указан, используем только имя файла
        // Возвращаем успешный ответ со статусом 201 Created
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName, // Путь к сохраненному файлу на сервере
            originalName: req.file.originalname, // Оригинальное имя файла от клиента
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
