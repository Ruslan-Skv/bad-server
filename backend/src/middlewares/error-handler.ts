import { ErrorRequestHandler } from 'express'

// Создаем middleware для обработки ошибок
const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    // Определяем статус код ошибки:
    // - Если у ошибки есть свойство statusCode, используем его
    // - Если нет, используем 500 (Internal Server Error)
    const statusCode = err.statusCode || 500
    // Формируем сообщение для клиента:
    // - Для 500 ошибок показываем общее сообщение (без деталей для безопасности)
    // - Для остальных ошибок используем сообщение из объекта ошибки
    const message =
        statusCode === 500 ? 'На сервере произошла ошибка' : err.message
    // Логируем полную ошибку в консоль для разработчиков
    // Здесь видна полная информация об ошибке
    console.log(err)

    // Отправляем ответ клиенту:
    // - Устанавливаем соответствующий HTTP статус код
    // - Отправляем JSON с сообщением об ошибке
    res.status(statusCode).send({ message })

    next()
}

export default errorHandler
