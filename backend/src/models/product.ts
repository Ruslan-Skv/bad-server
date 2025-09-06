import { unlink } from 'fs' // Для удаления файлов
import mongoose, { Document } from 'mongoose'
import { join } from 'path'

export interface IFile {
    fileName: string  // Имя файла на сервере
    originalName: string // Оригинальное имя файла от пользователя
}

export interface IProduct extends Document {
    title: string
    image: IFile
    category: string
    description: string
    price: number
}

const cardsSchema = new mongoose.Schema<IProduct>(
    {
        title: {
            type: String,
            unique: true,
            required: [true, 'Поле "title" должно быть заполнено'],
            minlength: [2, 'Минимальная длина поля "title" - 2'],
            maxlength: [30, 'Максимальная длина поля "title" - 30'],
        },
        image: {
            fileName: {
                type: String,
                required: [true, 'Поле "image.fileName" должно быть заполнено'],
            },
            originalName: String,  // Опциональное оригинальное имя
        },
        category: {
            type: String,
            required: [true, 'Поле "category" должно быть заполнено'],
        },
        description: {
            type: String,  // Описание не обязательно
        },
        price: {
            type: Number,
            default: null,  // Цена может быть null
        },
    },
    { versionKey: false }
)

cardsSchema.index({ title: 'text' }) // Создает текстовый индекс для полнотекстового поиска по полю title

// Pre-update хук: Удаление старого изображения
// Можно лучше: удалять старое изображением перед обновлением сущности
cardsSchema.pre('findOneAndUpdate', async function deleteOldImage() {
    // @ts-ignore  - игнорирование ошибки TypeScript
    const updateImage = this.getUpdate().$set?.image // Получаем новое изображение из обновления
    const docToUpdate = await this.model.findOne(this.getQuery()) // Находим текущий документ
    if (updateImage && docToUpdate) {
        // Удаляем старое изображение с диска
        unlink(
            join(__dirname, `../public/${docToUpdate.image.fileName}`), // Формируем полный путь
            (err) => console.log(err)
        )
    }
})

// Post-delete хук: Удаление изображения при удалении товара
// Можно лучше: удалять файл с изображением после удаление сущности
cardsSchema.post('findOneAndDelete', async (doc: IProduct) => {
    // Удаляем файл изображения после удаления документа
    unlink(join(__dirname, `../public/${doc.image.fileName}`), (err) =>
        console.log(err)
    )
})

export default mongoose.model<IProduct>('product', cardsSchema)
