import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'  // Парсер куков для работы с cookies
import cors from 'cors'  // Middleware для обработки CORS
import 'dotenv/config' // Загрузка переменных окружения из .env файла
import express, { json, urlencoded } from 'express' // Express framework и middleware
import mongoose from 'mongoose' // ODM для работы с MongoDB
import path from 'path' // Утилиты для работы с путями файловой системы
import { DB_ADDRESS } from './config' // Конфигурация базы данных (импорт из локального файла)
import errorHandler from './middlewares/error-handler' // Кастомный обработчик ошибок
import serveStatic from './middlewares/serverStatic' // Кастомный middleware для serving static files
import routes from './routes' // Основные маршруты приложения

const { PORT = 3000 } = process.env
// Создание экземпляра Express приложения
const app = express()

// Middleware для парсинга cookies
// Позволяет работать с куками через req.cookies
app.use(cookieParser())

// app.use(cors())
app.use(cors({ origin: process.env.ORIGIN_ALLOW, credentials: true })); // credentials: true позволяет передавать куки и авторизационные headers
// app.use(express.static(path.join(__dirname, 'public')));

// Кастомный middleware для serving static files
// Обслуживает статические файлы из папки public
app.use(serveStatic(path.join(__dirname, 'public')))

// Middleware для парсинга application/x-www-form-urlencoded
// extended: true позволяет работать с сложными объектами (вложенными)
app.use(urlencoded({ extended: true }))
// Middleware для парсинга application/json
// Преобразует JSON тела запросов в JavaScript объекты
app.use(json())

// Обработка preflight запросов (OPTIONS) для всех маршрутов
// Необходимо для CORS при запросах с дополнительными headers
app.options('*', cors())
// Подключение основных маршрутов приложения
app.use(routes)
// Обработчик ошибок валидации celebrate
// Автоматически форматирует ошибки валидации в JSON
app.use(errors())
// Кастомный обработчик ошибок приложения
// Должен быть последним в цепочке middleware
app.use(errorHandler)

// Отключение ESLint предупреждения для console.log
// eslint-disable-next-line no-console

// Асинхронная функция инициализации приложения
const bootstrap = async () => {
    try {
        // Подключение к MongoDB базе данных
        // DB_ADDRESS импортируется из конфигурационного файла
        await mongoose.connect(DB_ADDRESS)
        // Запуск сервера на указанном порту
        // callback функция выполняется после успешного запуска
        await app.listen(PORT, () => console.log('ok'))
    } catch (error) {
        // Обработка ошибок инициализации
        // Вывод подробной информации об ошибке в консоль
        console.error(error)
    }
}

// Запуск процесса инициализации приложения
bootstrap()
