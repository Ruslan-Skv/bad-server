import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import { ACCESS_TOKEN } from '../config'
import ForbiddenError from '../errors/forbidden-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import UserModel, { Role } from '../models/user'

// есть файл middlewares/auth.js, в нём мидлвэр для проверки JWT;
// Основной middleware для проверки JWT токена (Основной middleware аутентификации)
const auth = async (req: Request, res: Response, next: NextFunction) => {
    let payload: JwtPayload | null = null
    // Получаем заголовок Authorization из запроса
    const authHeader = req.header('Authorization')
    // Проверяем наличие и формат заголовка (должен начинаться с "Bearer ")
    if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedError('Невалидный токен')
    }
    try {
        // Разделяем заголовок на части (Bearer и сам токен)
        const accessTokenParts = authHeader.split(' ')
        const aTkn = accessTokenParts[1]  // Извлекаем сам токен
        // Верифицируем JWT токен с использованием секретного ключа
        payload = jwt.verify(aTkn, ACCESS_TOKEN.secret) as JwtPayload

        // Ищем пользователя в базе данных по ID из токена (исключаем пароль и salt)
        const user = await UserModel.findOne(
            {
                _id: new Types.ObjectId(payload.sub),  // sub содержит ID пользователя
            },
            { password: 0, salt: 0 } // Исключаем чувствительные данные из результата
        )

        // Если пользователь не найден, возвращаем ошибку доступа
        if (!user) {
            return next(new ForbiddenError('Нет доступа'))
        }
        // Сохраняем информацию о пользователе в res.locals для использования в следующих middleware
        res.locals.user = user

        // Передаем управление следующему middleware
        return next()
    } catch (error) {
        if (error instanceof Error && error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Истек срок действия токена'))
        }
        return next(new UnauthorizedError('Необходима авторизация'))
    }
}

// Middleware проверки ролей
// Фабрика middleware для проверки ролей пользователя
export function roleGuardMiddleware(...roles: Role[]) {
    return (_req: Request, res: Response, next: NextFunction) => {
        // Проверяем, что пользователь был аутентифицирован
        if (!res.locals.user) {
            return next(new UnauthorizedError('Необходима авторизация'))
        }
        // Проверяем, есть ли у пользователя хотя бы одна из требуемых ролей
        const hasAccess = roles.some((role) =>
            res.locals.user.roles.includes(role)
        )
        // Если нет подходящих ролей, возвращаем ошибку доступа
        if (!hasAccess) {
            return next(new ForbiddenError('Доступ запрещен'))
        }
        // Передаем управление следующему middleware
        return next()
    }
}

// Middleware проверки владения ресурсом
// Фабрика middleware для проверки доступа к конкретному ресурсу
export function currentUserAccessMiddleware<T>(
    model: Model<T>,  // Модель Mongoose для сущности
    idProperty: string,  // Название параметра в URL, содержащего ID
    userProperty: keyof T  // Поле в сущности, содержащее ID пользователя-владельца
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Извлекаем ID сущности из параметров запроса
        const id = req.params[idProperty]

        // Проверяем, что пользователь аутентифицирован
        if (!res.locals.user) {
            return next(new UnauthorizedError('Необходима авторизация'))
        }

        // Админы имеют доступ ко всем ресурсам
        if (res.locals.user.roles.includes(Role.Admin)) {
            return next()
        }

        // Ищем сущность в базе данных
        const entity = await model.findById(id)

        // Если сущность не найдена, возвращаем ошибку
        if (!entity) {
            return next(new NotFoundError('Не найдено'))
        }

        // Получаем ID владельца сущности и сравниваем с ID текущего пользователя
        const userEntityId = entity[userProperty] as Types.ObjectId
        const hasAccess = new Types.ObjectId(res.locals.user.id).equals(
            userEntityId
        )

        // Если пользователь не является владельцем, возвращаем ошибку доступа
        if (!hasAccess) {
            return next(new ForbiddenError('Доступ запрещен'))
        }
        // Передаем управление следующему middleware
        return next()
    }
}

export default auth
