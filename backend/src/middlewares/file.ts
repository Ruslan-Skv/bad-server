import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'  // Middleware для обработки файлов
import { join } from 'path'  // Утилита для работы с путями

//middleware для работы с файлами
// Определяем типы для callback-функций multer
type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

// Создаем конфигурацию для хранения файлов на диске
const storage = multer.diskStorage({
    // Функция для определения пути сохранения файлов
    destination: (
        _req: Request, // Запрос (не используется здесь)
        _file: Express.Multer.File, // Файл (не используется здесь)
        cb: DestinationCallback  // Callback функция для возврата пути
    ) => {
        // Формируем путь для сохранения файлов:
        // - __dirname - текущая директория файла
        // - process.env.UPLOAD_PATH_TEMP - переменная окружения для кастомного пути
        // - Если UPLOAD_PATH_TEMP не задан, используем '../public'
        cb(
            null,  // Первый параметр - ошибка (null если нет ошибки)
            join(
                __dirname,
                process.env.UPLOAD_PATH_TEMP
                    ? `../public/${process.env.UPLOAD_PATH_TEMP}`
                    : '../public'
            )
        )
        // Пример: 
        // Если UPLOAD_PATH_TEMP = 'uploads/temp', то путь будет:
        // /app/src/middlewares/../public/uploads/temp
        // что эквивалентно: /app/public/uploads/temp
    },

    // Функция для определения имени сохраняемого файла
    filename: (
        _req: Request,
        file: Express.Multer.File,  // Объект файла
        cb: FileNameCallback  // Callback функция для возврата имени файла
    ) => {
        // Сохраняем файл с оригинальным именем
        cb(null, file.originalname)
        // Это может привести к конфликтам, если файлы с одинаковыми именами
        // будут загружаться разными пользователями
    },
})

// Массив разрешенных MIME-типов файлов
const types = [
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
]

// Функция-фильтр для проверки типа загружаемых файлов
const fileFilter = (
    _req: Request,
    file: Express.Multer.File,  // Объект файла для проверки
    cb: FileFilterCallback // Callback функция для разрешения/запрета загрузки
) => {
    // Проверяем, есть ли MIME-тип файла в списке разрешенных
    if (!types.includes(file.mimetype)) {
        // Если тип не разрешен, возвращаем false во втором параметре
        return cb(null, false)
        // Файл не будет сохранен, но ошибка не возникнет
    }
    // Если тип разрешен, возвращаем true
    return cb(null, true)
    // Файл будет обработан и сохранен
}

// Экспортируем настроенный экземпляр multer
export default multer({
    storage, // Конфигурация хранения
    fileFilter // Фильтр типов файлов
})

// Дополнительные настройки по умолчанию:
// - limit: нет ограничений на размер файла
// - fields: не ограничено количество полей
// - etc: другие настройки multer по умолчанию
