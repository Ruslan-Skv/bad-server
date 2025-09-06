import mongoose, { Document, Schema } from 'mongoose'

// код реализует модель счетчика (counter) для MongoDB с использованием Mongoose
interface ICounter extends Document {
    sequenceValue: number // текущее значение счетчика
}

const counterSchema = new Schema<ICounter>({ // создание схемы с типизацией через Generic параметр
    sequenceValue: {
        type: Number,
        required: true,
    },
})

export default mongoose.model<ICounter>('counter', counterSchema)
