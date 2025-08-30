import { NextFunction, Request, Response } from 'express'
import fs from 'fs' // File System модуль для работы с файловой системой
import path from 'path'

//middleware для serving static файлов
export default function serveStatic(baseDir: string) {
    // Функция возвращает middleware с сигнатурой (req, res, next)
    return (req: Request, res: Response, next: NextFunction) => {
        // Определяем полный путь к запрашиваемому файлу
        // - baseDir: базовая директория (например, '/public')
        // - req.path: путь из URL запроса (например, '/images/photo.jpg')
        // - path.join(): безопасно объединяет пути, учитывая особенности ОС
        const filePath = path.join(baseDir, req.path)

        // Проверяем, существует ли файл
        // fs.constants.F_OK - флаг для проверки существования файла
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                // Файл не существует отдаем дальше мидлварам (err не null)
                return next()
            }
            // Файл существует, отправляем его клиенту
            return res.sendFile(filePath, (err) => {
                if (err) {
                    next(err)
                }
            })
        })
    }
}
