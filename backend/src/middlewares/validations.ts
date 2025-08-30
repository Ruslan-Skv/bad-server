import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

// Регулярное выражение для валидации телефонных номеров
// eslint-disable-next-line no-useless-escape
export const phoneRegExp = /^(\+\d+)?(?:\s|-?|\(?\d+\)?)+$/

// Enum для типов оплаты
export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

// валидация id
// Валидация заказа
export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        // Массив ID товаров с кастомной валидацией ObjectId
        items: Joi.array()
            .items(
                Joi.string().custom((value, helpers) => {
                    if (Types.ObjectId.isValid(value)) {
                        return value
                    }
                    return helpers.message({ custom: 'Невалидный id' })
                })
            )
            .messages({
                'array.empty': 'Не указаны товары',
            }),
        // Тип оплаты - только допустимые значения из enum
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'string.valid':
                    'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
                'string.empty': 'Не указан способ оплаты',
            }),
        // Email - обязательный и должен быть валидным
        email: Joi.string().email().required().messages({
            'string.empty': 'Не указан email',
        }),
        // Телефон - обязательный, должен соответствовать regex
        phone: Joi.string().required().pattern(phoneRegExp).messages({
            'string.empty': 'Не указан телефон',
        }),
        // Адрес - обязательный
        address: Joi.string().required().messages({
            'string.empty': 'Не указан адрес',
        }),
        // Сумма заказа - обязательное число
        total: Joi.number().required().messages({
            'string.empty': 'Не указана сумма заказа',
        }),
        // Комментарий - опциональное поле
        comment: Joi.string().optional().allow(''),
    }),
})

// Валидация создания товара
// name и link - обязательные поля, name - от 2 до 30 символов, link - валидный url
export const validateProductBody = celebrate({
    body: Joi.object().keys({
        // Название товара: 2-30 символов, обязательно
        title: Joi.string().required().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
            'string.empty': 'Поле "title" должно быть заполнено',
        }),
        // Объект изображения с обязательными полями
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        // Категория - обязательная
        category: Joi.string().required().messages({
            'string.empty': 'Поле "category" должно быть заполнено',
        }),
        // Описание - обязательное
        description: Joi.string().required().messages({
            'string.empty': 'Поле "description" должно быть заполнено',
        }),
        // Цена - число, может быть null
        price: Joi.number().allow(null),
    }),
})

// Валидация обновления товара
export const validateProductUpdateBody = celebrate({
    body: Joi.object().keys({
        // Все поля опциональны при обновлении
        title: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string(),
        description: Joi.string(),
        price: Joi.number().allow(null),
    }),
})

// Валидация ObjectId в параметрах (validateObjId)
export const validateObjId = celebrate({
    params: Joi.object().keys({
        productId: Joi.string()
            .required()
            .custom((value, helpers) => {
                // Кастомная валидация MongoDB ObjectId
                if (Types.ObjectId.isValid(value)) {
                    return value
                }
                return helpers.message({ any: 'Невалидный id' })
            }),
    }),
})

// Валидация пользователя (validateUserBody)
export const validateUserBody = celebrate({
    body: Joi.object().keys({
        // Имя: 2-30 символов, опционально
        name: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
        }),
        // Пароль: минимум 6 символов, обязательно
        password: Joi.string().min(6).required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
        // // Email: обязательный, должен быть валидным
        email: Joi.string()
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.empty': 'Поле "email" должно быть заполнено',
            }),
    }),
})

// Валидация аутентификации (validateAuthentication)
export const validateAuthentication = celebrate({
    body: Joi.object().keys({
        // Email для входа
        email: Joi.string()
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.required': 'Поле "email" должно быть заполнено',
            }),
            // Пароль для входа
        password: Joi.string().required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
    }),
})
