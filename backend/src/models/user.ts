/* eslint-disable no-param-reassign */
import crypto from 'crypto' // хеширование refresh токенов
import jwt from 'jsonwebtoken'
import mongoose, { Document, HydratedDocument, Model, Types } from 'mongoose'
import validator from 'validator'
// import md5 from 'md5' // для хеширования паролей (не рекомендуется для production)
import bcrypt from 'bcrypt'
import { BCRYPT_CONFIG } from '../config';

import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config'
import UnauthorizedError from '../errors/unauthorized-error'

export enum Role {
    Customer = 'customer', //обычный пользователь
    Admin = 'admin', //администратор
}

export interface IUser extends Document {
    name: string
    email: string
    password: string
    tokens: { token: string }[] //массив хешей refresh токенов
    roles: Role[] //роли пользователя в системе
    phone: string
    totalAmount: number
    orderCount: number
    orders: Types.ObjectId[]
    lastOrderDate: Date | null
    lastOrder: Types.ObjectId | null
}

interface IUserMethods {
    generateAccessToken(): string
    generateRefreshToken(): Promise<string>
    toJSON(): string
    calculateOrderStats(): Promise<void>
}

interface IUserModel extends Model<IUser, {}, IUserMethods> {
    findUserByCredentials: (
        email: string,
        password: string
    ) => Promise<HydratedDocument<IUser, IUserMethods>>
}

const userSchema = new mongoose.Schema<IUser, IUserModel, IUserMethods>(
    {
        name: {
            type: String,
            default: 'Евлампий',
            minlength: [2, 'Минимальная длина поля "name" - 2'],
            maxlength: [30, 'Максимальная длина поля "name" - 30'],
        },
        // в схеме пользователя есть обязательные email и password
        email: {
            type: String,
            required: [true, 'Поле "email" должно быть заполнено'],
            unique: true, // поле email уникально (есть опция unique: true);
            validate: {
                // для проверки email студенты используют validator
                validator: (v: string) => validator.isEmail(v),
                message: 'Поле "email" должно быть валидным email-адресом',
            },
        },
        // поле password не имеет ограничения на длину, т.к. пароль хранится в виде хэша
        password: {
            type: String,
            required: [true, 'Поле "password" должно быть заполнено'],
            minlength: [6, 'Минимальная длина поля "password" - 6'],
            select: false, // Пароль исключается из запросов по умолчанию
        },

        tokens: [
            {
                token: { required: true, type: String },
            },
        ],
        roles: {
            type: [String],
            enum: Object.values(Role),
            default: [Role.Customer],
        },
        phone: {
            type: String,
        },
        lastOrderDate: {
            type: Date,
            default: null,
        },
        lastOrder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'order',
            default: null,
        },
        totalAmount: { type: Number, default: 0 },
        orderCount: { type: Number, default: 0 },
        orders: [
            {
                type: Types.ObjectId,
                ref: 'order',
            },
        ],
    },
    {
        versionKey: false,
        timestamps: true,
        // Возможно удаление пароля в контроллере создания, т.к. select: false не работает в случае создания сущности https://mongoosejs.com/docs/api/document.html#Document.prototype.toJSON()
        toJSON: {
            virtuals: true,
            transform: (_doc, ret) => {
                // delete ret.tokens
                // delete ret.password
                // delete ret._id
                // delete ret.roles
                delete (ret as any).tokens;
                delete (ret as any).password;
                delete (ret as any)._id;
                delete (ret as any).roles;
                return ret
            },
        },
    }
)

// Middleware для хеширования пароля
// Возможно добавление хеша в контроллере регистрации
userSchema.pre('save', async function hashingPassword(next) {
    try {
        // Хешируем пароль только если он был изменен
        if (this.isModified('password')) {
            // this.password = md5(this.password)
            this.password = await bcrypt.hash(this.password, BCRYPT_CONFIG.saltRounds);
        }
        next()
    } catch (error) {
        next(error as Error)
    }
})

// Можно лучше: централизованное создание accessToken и  refresh токена
userSchema.methods.generateAccessToken = function generateAccessToken() {
    // const user = this
    const user = this as HydratedDocument<IUser, IUserMethods> & { _id: Types.ObjectId };
    // Создание accessToken токена возможно в контроллере авторизации
    // Создание JWT access токена
    return jwt.sign(
        {
            _id: user._id.toString(),
            email: user.email,
        },
        ACCESS_TOKEN.secret,
        {
            expiresIn: ACCESS_TOKEN.expiry,  // Время жизни токена
            // subject: user.id.toString(), // Subject = ID пользователя
            subject: user._id.toString(),
        }
    )
}

userSchema.methods.generateRefreshToken =
    async function generateRefreshToken() {
        // const user = this
        const user = this as HydratedDocument<IUser, IUserMethods> & { _id: Types.ObjectId };
        // Создание refresh токена возможно в контроллере авторизации/регистрации
        // Создание JWT refresh токена
        const refreshToken = jwt.sign(
            {
                _id: user._id.toString(),
            },
            REFRESH_TOKEN.secret,
            {
                expiresIn: REFRESH_TOKEN.expiry,
                // subject: user.id.toString(),
                subject: user._id.toString(),
            }
        )

        // Можно лучше: Создаем хеш refresh токена
        // Хеширование refresh токена перед сохранением в БД
        const rTknHash = crypto
            .createHmac('sha256', REFRESH_TOKEN.secret)
            .update(refreshToken)
            .digest('hex')

        // Сохраняем refresh токена в базу данных, можно делать в контроллере авторизации/регистрации
        user.tokens.push({ token: rTknHash })
        await user.save()

        return refreshToken // Возвращаем оригинальный токен клиенту
}

// Статический метод для аутентификации
userSchema.statics.findUserByCredentials = async function findByCredentials(
    email: string,
    password: string
) {
    // Ищем пользователя с включенным паролем (select: false)
    const user = await this.findOne({ email })
        .select('+password')
        .orFail(() => new UnauthorizedError('Неправильные почта или пароль'))
    // Сравниваем хеши паролей
    // const passwdMatch = md5(password) === user.password
    // Сравниваем пароль с хешем в базе данных
    const passwdMatch = await bcrypt.compare(password, user.password);
    if (!passwdMatch) {
        return Promise.reject(
            new UnauthorizedError('Неправильные почта или пароль')
        )
    }
    return user
}

// Метод для расчета статистики заказов
userSchema.methods.calculateOrderStats = async function calculateOrderStats() {
    const user = this
    // Агрегация для подсчета статистики заказов
    const orderStats = await mongoose.model('order').aggregate([
        { $match: { customer: user._id } }, // Только заказы этого пользователя
        {
            $group: {
                _id: null,
                totalAmount: { $sum: '$totalAmount' }, // Общая сумма заказов
                lastOrderDate: { $max: '$createdAt' }, // Дата последнего заказа
                orderCount: { $sum: 1 }, // Количество заказов
                lastOrder: { $last: '$_id' }, // ID последнего заказа
            },
        },
    ])

    // Обновляем статистику пользователя
    if (orderStats.length > 0) {
        const stats = orderStats[0]
        user.totalAmount = stats.totalAmount
        user.orderCount = stats.orderCount
        user.lastOrderDate = stats.lastOrderDate
        user.lastOrder = stats.lastOrder
    } else {
        // Сбрасываем статистику если заказов нет
        user.totalAmount = 0
        user.orderCount = 0
        user.lastOrderDate = null
        user.lastOrder = null
    }

    await user.save()  // Сохраняем изменения
}
const UserModel = mongoose.model<IUser, IUserModel>('user', userSchema)

export default UserModel
