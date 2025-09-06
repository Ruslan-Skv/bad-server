import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { join } from 'path' // Утилита для работы с путями
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile' // Утилита для перемещения файлов

// GET /product - Получение списка товаров с пагинацией
const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Извлекаем параметры пагинации из query string (по умолчанию: страница 1, лимит 5)
        const { page = 1, limit = 5 } = req.query
        // Настройки для пагинации в MongoDB
        const options = {
            skip: (Number(page) - 1) * Number(limit), // Пропустить N документов
            limit: Number(limit), // Ограничить количество документов
        }
        const products = await Product.find({}, null, options) // Получаем товары с применением пагинации
        const totalProducts = await Product.countDocuments({}) // Получаем общее количество товаров
        const totalPages = Math.ceil(totalProducts / Number(limit)) // Вычисляем общее количество страниц
        return res.send({  // Возвращаем ответ с товарами и информацией о пагинации
            items: products, // Массив товаров
            pagination: { // Метаданные пагинации
                totalProducts, // Общее количество товаров
                totalPages, // Общее количество страниц
                currentPage: Number(page), // Текущая страница
                pageSize: Number(limit), // Размер страницы
            },
        })
    } catch (err) {
        return next(err) // Передаем ошибку в обработчик ошибок Express
    }
}

// POST /product - Создание нового товара
const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { description, category, price, title, image } = req.body // Извлекаем данные товара из тела запроса

        // Переносим картинку из временной папки
        // Если есть изображение, перемещаем его из временной папки в постоянную
        if (image) {
            movingFile(
                image.fileName, // Имя файла
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`), // Путь к временной папке
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)  // Путь к постоянной папке
            )
        }
        // Создаем новый товар в базе данных
        const product = await Product.create({
            description,
            image,
            category,
            price,
            title,
        })
        return res.status(constants.HTTP_STATUS_CREATED).send(product) // Возвращаем созданный товар со статусом 201 (Created)
    } catch (error) {
        // Обработка ошибок валидации Mongoose
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        // Обработка ошибки дублирования (уникальные поля)
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        // Передаем другие ошибки в обработчик ошибок
        return next(error)
    }
}

// TODO: Добавить guard admin - нужна проверка прав администратора
// PUT /product
// PUT /product/:productId - Обновление товара
const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Извлекаем ID товара из параметров URL
        const { productId } = req.params
        const { image } = req.body

        // Переносим картинку из временной папки
        // Если есть новое изображение, перемещаем его
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }
        // Обновляем товар в базе данных
        const product = await Product.findByIdAndUpdate(
            productId,  // ID товара для поиска
            {
                $set: {  // Оператор установки значений
                    ...req.body,  // Все поля из тела запроса
                    price: req.body.price ? req.body.price : null,  // Обработка цены
                    image: req.body.image ? req.body.image : undefined,  // Обработка изображения
                },
            },
            { 
                runValidators: true, // Запуск валидации при обновлении
                new: true // Возвращать обновленный документ
            }  
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))  // Если товар не найден
        // Возвращаем обновленный товар
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// TODO: Добавить guard admin  - нужна проверка прав администратора
// DELETE /product
// DELETE /product/:productId - Удаление товара
const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Извлекаем ID товара из параметров URL
        const { productId } = req.params
        // Удаляем товар из базы данных
        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')  // Если товар не найден
        )
        // Возвращаем удаленный товар
        return res.send(product)
    } catch (error) {
        // Обработка ошибки невалидного ID
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
