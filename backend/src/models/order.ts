/* eslint-disable prefer-arrow-callback */
import mongoose, { Document, Schema, Types } from 'mongoose'
import validator from 'validator'
import { PaymentType, phoneRegExp } from '../middlewares/validations'
import Counter from './counter'
import User from './user'

// Enum статусов заказа
export enum StatusType {
    Cancelled = 'cancelled',
    Completed = 'completed',
    New = 'new',
    Delivering = 'delivering',
}

export interface IOrder extends Document {
    id: Types.ObjectId
    orderNumber: number
    status: string
    totalAmount: number
    products: Types.ObjectId[]
    payment: PaymentType
    customer: Types.ObjectId
    deliveryAddress: string
    phone: string
    comment: string
    email: string
}

// Схема данных
const orderSchema: Schema = new Schema(
    {
        orderNumber: { type: Number, unique: true },  // Уникальный номер заказа
        status: {
            type: String,
            enum: Object.values(StatusType),  // Только допустимые статусы
            default: StatusType.New, // Статус по умолчанию
        },
        totalAmount: { type: Number, required: true }, // Общая сумма
        products: [
            {
                type: Types.ObjectId,
                ref: 'product',  // Ссылка на модель товаров
            },
        ],
        payment: {
            type: String,
            enum: Object.values(PaymentType),  // Только допустимые способы оплаты
            required: true,
        },
        customer: { type: Types.ObjectId, ref: 'user' },  // Ссылка на пользователя
        deliveryAddress: { type: String },
        email: {
            type: String,
            required: [true, 'Поле "email" должно быть заполнено'],
            validate: {
                validator: (v: string) => validator.isEmail(v),  // Валидация email
                message: 'Поле "email" должно быть валидным email-адресом',
            },
        },
        phone: {
            type: String,
            required: [true, 'Поле "phone" должно быть заполнено'],
            validate: {
                validator: (v: string) => phoneRegExp.test(v),  // Валидация телефона
                message: 'Поле "phone" должно быть валидным телефоном.',
            },
        },
        comment: {
            type: String,
            default: '',  // Пустой комментарий по умолчанию
        },
    },
    { 
        versionKey: false, // Отключает автоматическое добавление поля __v (которое отслеживает версию документа)
        timestamps: true // Включает автоматическое добавление и управление полями createdAt (дата создания) и updatedAt (дата последнего обновления)
    }
)

// Pre-save хук: Генерация номера заказа
orderSchema.pre('save', async function incrementOrderNumber(next) {
    const order = this

    if (order.isNew) {  // Только для новых документов
        const counter = await Counter.findOneAndUpdate(
            {},
            { $inc: { sequenceValue: 1 } },  // Атомарное увеличение счетчика
            { new: true, upsert: true }  // Вернуть обновленный документ, создать если нет
        )

        order.orderNumber = counter.sequenceValue  // Присвоить номер заказа
    }

    next()
})

// Post-save хук: Обновление статистики пользователя
orderSchema.post('save', async function updateUserStats(doc) {
    await User.findById(doc.customer).then(function updateUser(user) {
        user?.orders.push(doc.id) // Добавить заказ в массив заказов пользователя
        user?.calculateOrderStats() // Пересчитать статистику
    })
})

// Post-findOneAndDelete хук: Очистка при удалении
orderSchema.post('findOneAndDelete', async function updateUserStats(order) {
    await User.findByIdAndUpdate(order.customer, {
        $pull: { orders: order._id }, // Удалить заказ из массива пользователя
    }).then((user) => user?.calculateOrderStats()) // Пересчитать статистику
})

export default mongoose.model<IOrder>('order', orderSchema)
