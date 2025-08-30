import { CookieOptions } from 'express'  // Тип для опций cookie
import ms from 'ms'  // Библиотека для конвертации строки времени в миллисекунды
import 'dotenv/config'

// process.env.PORT берется из переменных окружения, если не задан - используется '3000'
export const { PORT = '3000' } = process.env
export const { DB_ADDRESS = 'mongodb://127.0.0.1:27017/weblarek' } = process.env
// Конфигурация Access Token (короткоживущий токен для авторизации запросов)
// export const { JWT_SECRET = 'JWT_SECRET' } = process.env
// Конфигурация Access Token (короткоживущий токен для авторизации запросов)
export const ACCESS_TOKEN = {
    // secret: process.env.AUTH_ACCESS_TOKEN_SECRET || 'secret-dev',  // Секретный ключ для подписи access token
    secret: process.env.AUTH_ACCESS_TOKEN_SECRET as string,
    expiry: process.env.AUTH_ACCESS_TOKEN_EXPIRY || '1d', // Время жизни access token  
}
// Конфигурация Refresh Token (долгоживущий токен для обновления access token)
export const REFRESH_TOKEN = {
    // secret: process.env.AUTH_REFRESH_TOKEN_SECRET || 'secret-dev', // Секретный ключ для подписи refresh token
    secret: process.env.AUTH_REFRESH_TOKEN_SECRET as string, 
    expiry: process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d', // Время жизни refresh token (По умолчанию: 7 дней) 
    // Настройки cookie для хранения refresh token
    cookie: {
        // Название cookie в браузере
        name: 'refreshToken',
        // Опции cookie для безопасности и управления
        options: {
            httpOnly: true,  // Запрещает доступ к cookie через JavaScript (защита от XSS)
            sameSite: 'lax',  // Ограничивает отправку cookie между сайтами (защита от CSRF). 'strict' - более строгая политика
            secure: false,    // true: cookie только по HTTPS (в production должно быть true)
            maxAge: ms(process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d'), // Время жизни cookie в миллисекундах (Конвертирует строку времени в миллисекунды)
            // Путь, для которого cookie действителен
            path: '/',  // Доступно для всех путей на домене
        } as CookieOptions,
    },
}

export const BCRYPT_CONFIG = {
    saltRounds: 10,
};
