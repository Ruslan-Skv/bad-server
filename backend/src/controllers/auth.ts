import crypto from 'crypto' // Криптографические функции для создания хешей
import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2' // HTTP статус-коды
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Error as MongooseError } from 'mongoose' // Ошибки Mongoose
import { REFRESH_TOKEN } from '../config' // Конфигурация refresh токена
import BadRequestError from '../errors/bad-request-error' // Кастомная ошибка 400
import ConflictError from '../errors/conflict-error' // Кастомная ошибка 409
import NotFoundError from '../errors/not-found-error' // Кастомная ошибка 404
import UnauthorizedError from '../errors/unauthorized-error' // Кастомная ошибка 401
import User from '../models/user'

// POST /auth/login  - аутентификация пользователя
const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Извлечение email и password из тела запроса
        const { email, password } = req.body
        // Поиск пользователя и проверка credentials
        const user = await User.findUserByCredentials(email, password)
        // Генерация access токена
        const accessToken = user.generateAccessToken()
        // Генерация refresh токена (долгоживущий) и сохранение в БД
        const refreshToken = await user.generateRefreshToken()
        // Установка refresh токена в HTTP-only cookie
        res.cookie(
            REFRESH_TOKEN.cookie.name,  // Название куки
            refreshToken,  // Значение токена
            REFRESH_TOKEN.cookie.options // Опции 
        )
        // Возврат успешного ответа с пользователем и access токеном
        return res.json({
            success: true,
            user,  // Данные пользователя
            accessToken,  // Access токен для авторизации запросов
        })
    } catch (err) {
        // Передача ошибки в централизованный обработчик
        return next(err)
    }
}

// POST /auth/register  - регистрация нового пользователя
const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Извлечение данных из тела запроса
        const { email, password, name } = req.body
        // Создание нового пользователя
        const newUser = new User({ email, password, name })
        // Сохранение пользователя в базу данных
        await newUser.save()
        // Генерация токенов
        const accessToken = newUser.generateAccessToken()
        const refreshToken = await newUser.generateRefreshToken()

        // Установка refresh токена в cookie
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        // Возврат ответа со статусом 201 (Created)
        return res.status(constants.HTTP_STATUS_CREATED).json({
            success: true,
            user: newUser,
            accessToken,
        })
    } catch (error) {
        // Обработка ошибок валидации Mongoose
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        // Обработка ошибки дубликата email (MongoDB error code E11000)
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Пользователь с таким email уже существует')
            )
        }
        // Передача других ошибок
        return next(error)
    }
}

// GET /auth/user - получение данных текущего пользователя
const getCurrentUser = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Извлечение ID пользователя из res.locals (установлено в auth middleware)
        const userId = res.locals.user._id
        // Поиск пользователя в базе данных
        const user = await User.findById(userId).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        // Возврат данных пользователя
        res.json({ user, success: true })
    } catch (error) {
        next(error)
    }
}

// Можно лучше: вынести общую логику получения данных из refresh токена
// Вспомогательная функция для удаления refresh токена из базы данных
const deleteRefreshTokenInUser = async (
    req: Request,
    _res: Response,
    _next: NextFunction
) => {
    // Извлечение cookies из запроса
    const { cookies } = req
    const rfTkn = cookies[REFRESH_TOKEN.cookie.name]

    if (!rfTkn) {
        throw new UnauthorizedError('Не валидный токен')
    }

    // Верификация и декодирование refresh токена
    const decodedRefreshTkn = jwt.verify(
        rfTkn,
        REFRESH_TOKEN.secret
    ) as JwtPayload
    // Поиск пользователя по ID из токена
    const user = await User.findOne({
        _id: decodedRefreshTkn._id,
    }).orFail(() => new UnauthorizedError('Пользователь не найден в базе'))

    // Создание хеша токена для сравнения с хранимым в базе
    const rTknHash = crypto
        .createHmac('sha256', REFRESH_TOKEN.secret) // Алгоритм хеширования
        .update(rfTkn) // Данные для хеширования
        .digest('hex') // Формат вывода

    // Удаление токена из массива tokens пользователя
    user.tokens = user.tokens.filter((tokenObj) => tokenObj.token !== rTknHash)

    // Сохранение изменений в базе данных
    await user.save()

    return user
}

// Реализация удаления токена из базы может отличаться
// GET  /auth/logout  - выход пользователя (инвалидация токенов)
const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Удаление refresh токена из базы данных
        await deleteRefreshTokenInUser(req, res, next)
        // Очистка refresh токена из cookie (установка maxAge: -1)
        const expireCookieOptions = {
            ...REFRESH_TOKEN.cookie.options,
            maxAge: -1,  // Немедленное истечение cookie
        }
        res.cookie(REFRESH_TOKEN.cookie.name, '', expireCookieOptions)
        // Возврат успешного ответа
        res.status(200).json({
            success: true,
        })
    } catch (error) {
        next(error)
    }
}

// GET  /auth/token  - обновление access токена с помощью refresh токена
const refreshAccessToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Удаление старого refresh токена и получение пользователя
        const userWithRefreshTkn = await deleteRefreshTokenInUser(
            req,
            res,
            next
        )
        // Генерация нового access токена
        const accessToken = await userWithRefreshTkn.generateAccessToken()
        // Генерация нового refresh токена
        const refreshToken = await userWithRefreshTkn.generateRefreshToken()
        // Установка нового refresh токена в cookie
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        // Возврат новых токенов и данных пользователя
        return res.json({
            success: true,
            user: userWithRefreshTkn,
            accessToken,
        })
    } catch (error) {
        return next(error)
    }
}

// GET /auth/roles - получение ролей текущего пользователя
const getCurrentUserRoles = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        // Проверка существования пользователя
        await User.findById(userId, req.body, {
            new: true,
        }).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        // Возврат ролей пользователя из res.locals
        res.status(200).json(res.locals.user.roles)
    } catch (error) {
        next(error)
    }
}

// PATCH /auth/user - обновление данных текущего пользователя
const updateCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        // Поиск и обновление пользователя
        const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
            new: true, // Возвращать обновленный документ
        }).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        // Возврат обновленных данных пользователя
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

export {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
}
