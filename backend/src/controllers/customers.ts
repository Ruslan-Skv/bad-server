import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'

// контроллеры для работы с пользователями в административной панели
// TODO: Добавить guard admin
// eslint-disable-next-line max-len
// Get GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Извлекаем параметры запроса из query string
        const {
            page = 1,  // Текущая страница (по умолчанию 1)
            limit = 10, // Количество элементов на странице (по умолчанию 10)
            sortField = 'createdAt', // Поле для сортировки (по умолчанию дата создания)
            sortOrder = 'desc', // Порядок сортировки (по умолчанию descending)
            registrationDateFrom, // Дата регистрации от
            registrationDateTo, // Дата регистрации до
            lastOrderDateFrom, // Дата последнего заказа от
            lastOrderDateTo, // Дата последнего заказа до
            totalAmountFrom, // Общая сумма заказов от
            totalAmountTo, // Общая сумма заказов до
            orderCountFrom, // Количество заказов от
            orderCountTo, // Количество заказов до
            search, // Поисковый запрос
        } = req.query

        // Создаем объект фильтров для MongoDB
        const filters: FilterQuery<Partial<IUser>> = {}

        // Фильтр по дате регистрации (от)
        if (registrationDateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: new Date(registrationDateFrom as string),  // Больше или равно указанной дате
            }
        }

        // Фильтр по дате регистрации (до)
        if (registrationDateTo) {
            const endOfDay = new Date(registrationDateTo as string)
            endOfDay.setHours(23, 59, 59, 999)  // Устанавливаем конец дня
            filters.createdAt = {
                ...filters.createdAt,
                $lte: endOfDay,  // Меньше или равно концу указанного дня
            }
        }

        // Фильтр по дате последнего заказа (от)
        if (lastOrderDateFrom) {
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: new Date(lastOrderDateFrom as string),
            }
        }

        // Фильтр по дате последнего заказа (до)
        if (lastOrderDateTo) {
            const endOfDay = new Date(lastOrderDateTo as string)
            endOfDay.setHours(23, 59, 59, 999)
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: endOfDay,
            }
        }

        // Фильтр по общей сумме заказов (от)
        if (totalAmountFrom) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: Number(totalAmountFrom),  // Больше или равно
            }
        }

        // Фильтр по общей сумме заказов (до)
        if (totalAmountTo) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: Number(totalAmountTo),  // Меньше или равно
            }
        }

        // Фильтр по количеству заказов (от)
        if (orderCountFrom) {
            filters.orderCount = {
                ...filters.orderCount,
                $gte: Number(orderCountFrom),
            }
        }

        // Фильтр по количеству заказов (до)
        if (orderCountTo) {
            filters.orderCount = {
                ...filters.orderCount,
                $lte: Number(orderCountTo),
            }
        }

        // Поиск по имени или адресу доставки
        if (search) {
            const searchRegex = new RegExp(search as string, 'i')  // Создаем regex для case-insensitive поиска
            const orders = await Order.find(
                {
                    $or: [{ deliveryAddress: searchRegex }],  // Ищем заказы с подходящим адресом доставки
                },
                '_id'  // Возвращаем только ID заказов
            )

            const orderIds = orders.map((order) => order._id)  // Получаем массив ID найденных заказов

            // Фильтр для поиска по имени пользователя или ID последнего заказа
            filters.$or = [
                { name: searchRegex },  // Поиск по имени пользователя
                { lastOrder: { $in: orderIds } },  // Поиск по ID последнего заказа
            ]
        }

        // Настройки сортировки
        const sort: { [key: string]: any } = {}

        if (sortField && sortOrder) {
            sort[sortField as string] = sortOrder === 'desc' ? -1 : 1 // -1 для descending, 1 для ascending
        }

        // Настройки пагинации
        const options = {
            sort, // Поле и порядок сортировки
            skip: (Number(page) - 1) * Number(limit), // Пропустить N документов
            limit: Number(limit), // Ограничить количество документов
        }

        // Получаем пользователей с применением фильтров, сортировки и пагинации
        const users = await User.find(filters, null, options).populate([
            'orders',  // Заполняем массив заказов пользователя
            {
                path: 'lastOrder',  // Заполняем последний заказ
                populate: {
                    path: 'products',  // В последнем заказе заполняем продукты
                },
            },
            {
                path: 'lastOrder',
                populate: {
                    path: 'customer',  // В последнем заказе заполняем информацию о клиенте
                },
            },
        ])

        // Получаем общее количество пользователей с учетом фильтров
        const totalUsers = await User.countDocuments(filters)
        // Вычисляем общее количество страниц
        const totalPages = Math.ceil(totalUsers / Number(limit))
        // Возвращаем ответ с клиентами и информацией о пагинации
        res.status(200).json({
            customers: users,  // Массив пользователей
            pagination: {
                totalUsers, // Общее количество пользователей
                totalPages, // Общее количество страниц
                currentPage: Number(page), // Текущая страница
                pageSize: Number(limit), // Размер страницы
            },
        })
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Get /customers/:id  - Получение клиента по ID
export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Находим пользователя по ID и заполняем связанные данные
        const user = await User.findById(req.params.id).populate([
            'orders',  // Все заказы пользователя
            'lastOrder',  // Последний заказ
        ])
        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Patch /customers/:id  - Обновление клиента
export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Обновляем пользователя и возвращаем обновленный документ
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,  // ID пользователя
            req.body,  // Данные для обновления
            {
                new: true,  // Возвращать обновленный документ
            }
        )
            .orFail(  // Если пользователь не найден
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
            .populate(['orders', 'lastOrder'])  // Заполняем связанные данные
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Delete /customers/:id  - Удаление клиента
export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Удаляем пользователя
        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
