import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
// import { sanitizeText } from '../utils/sanitize'
import sanitizeHtml from 'sanitize-html'
import escapeRegExp from '../utils/escapeRegExp'

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Извлекаем параметры запроса из query string
        const {
            page = 1,  // Текущая страница
            limit = 10, // Лимит на странице
            sortField = 'createdAt',  // Поле для сортировки
            sortOrder = 'desc', // Порядок сортировки
            status, // Статус заказа
            totalAmountFrom, // Сумма от
            totalAmountTo, // Сумма до  
            orderDateFrom, // Дата заказа от
            orderDateTo, // Дата заказа до
            search, // Поисковый запрос
        } = req.query

        // const actualLimit = Math.min(Number(limit), 10); // Максимум 10 записей
        // const skip = (Number(page) - 1) * actualLimit;
        const pageSize = Math.min(Math.max(Number(limit), 1), 10)
        const currentPage = Math.max(Number(page) || 1, 1)
        const skip = (currentPage - 1) * pageSize
        
        // console.log('Query params:', req.query);
        // console.log('Actual limit:', actualLimit);

        // Создаем объект фильтров для MongoDB
        const filters: FilterQuery<Partial<IOrder>> = {}

        // Фильтр по статусу заказа
        if (status) {
            if (typeof status === 'object') {
                Object.assign(filters, status) // Для массива статусов
            }
            if (typeof status === 'string') {
                filters.status = status // Для одиночного статуса
            }
        }

        // Фильтр по минимальной сумме заказа
        if (totalAmountFrom) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: Number(totalAmountFrom),  // Больше или равно
            }
        }

        // Фильтр по максимальной сумме заказа
        if (totalAmountTo) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: Number(totalAmountTo),  // Меньше или равно
            }
        }

        // Фильтр по дате заказа (от)
        if (orderDateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: new Date(orderDateFrom as string),
            }
        }

        // Фильтр по дате заказа (до)
        if (orderDateTo) {
            filters.createdAt = {
                ...filters.createdAt,
                $lte: new Date(orderDateTo as string),
            }
        }

        // Создаем агрегационный pipeline для сложных запросов
        const aggregatePipeline: any[] = [
            { $match: filters },  // Применяем фильтры
            {
                $lookup: {  // Join с коллекцией продуктов
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {  // Join с коллекцией пользователей
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            // { $unwind: '$customer' },  // Разворачиваем массив customer
            // { $unwind: '$products' },  // Разворачиваем массив products
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: '$products',
                    preserveNullAndEmptyArrays: true,
                },
            },
        ]

        // Поиск по номеру заказа или названию продукта
        if (search) {
            const searchRegex = new RegExp(escapeRegExp(search as string), 'i')  // Case-insensitive regex
            const searchNumber = Number(search)  // Пытаемся преобразовать в число
            // Экранирование специальных символов regex для безопасности
            // const sanitizedSearch = (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // const searchRegex = new RegExp(sanitizedSearch, 'i');
            // const searchNumber = Number(sanitizedSearch);

            const searchConditions: any[] = [{ 'products.title': searchRegex }] // Поиск по названию продукта

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })  // Поиск по номеру заказа
            }

            // Добавляем поиск в pipeline
            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,  // Ищем по любому из условий
                },
            })

            filters.$or = searchConditions  // Также добавляем в фильтры для countDocuments
        }

        // Настройки сортировки
        const sort: { [key: string]: any } = {}

        if (sortField && sortOrder) {
            sort[sortField as string] = sortOrder === 'desc' ? -1 : 1
        }

        // Добавляем пагинацию и группировку в pipeline
        aggregatePipeline.push(
            { $sort: sort },
            { $skip: skip},
            { $limit: pageSize },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },  // Собираем продукты обратно в массив
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        // Выполняем агрегационный запрос
        const orders = await Order.aggregate(aggregatePipeline)
        // Считаем общее количество заказов с учетом фильтров
        const totalOrders = await Order.countDocuments(filters)
        // Вычисляем общее количество страниц
        const totalPages = Math.ceil(totalOrders / pageSize)

        console.log('Orders count:', orders.length);
        console.log('Total orders:', totalOrders);

        // Возвращаем ответ
        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: Number(page),
                pageSize: pageSize,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Получение заказов текущего пользователя
export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id  // ID пользователя из middleware аутентификации
        const { search, page = 1, limit = 5 } = req.query

        const actualLimit = Math.min(Number(limit), 10);
        const skip = (Number(page) - 1) * actualLimit;

        // Настройки пагинации
        // const options = {
        //     skip: (Number(page) - 1) * Number(limit),
        //     limit: Number(limit),
        // }

        // Находим пользователя с populate заказов
        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',  // Заполняем продукты в заказах
                    },
                    {
                        path: 'customer',  // Заполняем информацию о клиенте
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        // Поиск по номеру заказа или названию продукта
        if (search) {
            // если не экранировать то получаем Invalid regular expression: /+1/i: Nothing to repeat
            const searchRegex = new RegExp(escapeRegExp(search as string), 'i')
            const searchNumber = Number(search)
            // const sanitizedSearch = (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // const searchRegex = new RegExp(sanitizedSearch, 'i');
            // const searchNumber = Number(sanitizedSearch);
            // Ищем продукты по названию
            const products = await Product.find({ title: searchRegex })
            // const productIds = products.map((product) => product._id)
            const productIds = products.map((product) => product._id) as Types.ObjectId[];

            // Фильтруем заказы
            orders = orders.filter((order) => {
                // eslint-disable-next-line max-len
                // Проверяем, есть ли в заказе продукты с подходящим названием
                // const matchesProductTitle = order.products.some((product) =>
                //     productIds.some((id) => id.equals(product._id))
                // )
                const matchesProductTitle = order.products.some((product: any) =>
                    productIds.some((id: Types.ObjectId) => id.equals((product as any)._id))
                )
                // eslint-disable-next-line max-len
                // Проверяем совпадение по номеру заказа
                const matchesOrderNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        // Пагинация
        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / actualLimit)

        orders = orders.slice(skip, skip + actualLimit)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: Number(page),
                pageSize: actualLimit,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
// Получение заказа по номеру (для администратора)
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,  // Поиск по номеру заказа
        })
            .populate(['customer', 'products'])  // Заполняем связанные данные
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Получение заказа по номеру для текущего пользователя
export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        // Проверяем, принадлежит ли заказ текущему пользователю
        if (!order.customer._id.equals(userId)) {
            // Если нет доступа не возвращаем 403, а отдаем 404
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
// Создание нового заказа
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []  // Корзина товаров
        const products = await Product.find<IProduct>({})  // Все продукты
        const userId = res.locals.user._id  // ID текущего пользователя
        // Данные из тела запроса
        const { address, payment, phone, total, email, items, comment } =
            req.body

        // САНИТИЗИРУЕМ КОММЕНТАРИЙ ↓
        const sanitizedComment = comment ? sanitizeHtml(comment) : '';

        // Формируем корзину и проверяем товары
        items.forEach((id: Types.ObjectId) => {
            // const product = products.find((p) => p._id.equals(id))
            const product = products.find((p: any) => (p as any)._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        // Проверяем сумму заказа
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        // Создаем новый заказ
        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment: sanitizedComment,
            customer: userId,
            deliveryAddress: address,
        })
        // Заполняем связанные данные и сохраняем
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
// Обновление заказа (в основном статуса)
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },  // Поиск по номеру заказа
            { status },  // Обновляем статус
            { new: true, runValidators: true }  // Возвращаем обновленный документ
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
// Удаление заказа
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
