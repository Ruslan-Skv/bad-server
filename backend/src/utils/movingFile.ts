// import { existsSync, rename } from 'fs'
// import { basename, join } from 'path'

// function movingFile(imagePath: string, from: string, to: string) {
//     const fileName = basename(imagePath) // Извлекаем имя файла из полного пути
//     const imagePathTemp = join(from, fileName) // Формируем временный путь к файлу (откуда перемещать)
//     const imagePathPermanent = join(to, fileName) // Формируем постоянный путь к файлу (куда перемещать)
//     // Проверяем, существует ли файл во временной директории
//     if (!existsSync(imagePathTemp)) { //Функция проверяет существование файла по пути from + fileName, а не по исходному imagePath
//         throw new Error('Ошибка при сохранении файла')
//     }

//     // Асинхронное перемещение файла
//     rename(imagePathTemp, imagePathPermanent, (err) => {
//         if (err) {
//             throw new Error('Ошибка при сохранении файла')
//         }
//     })
// }

// export default movingFile

import { existsSync, rename } from 'fs'
import { basename, join } from 'path'
import { promisify } from 'util'

// Преобразуем callback-функцию в Promise-based
const renameAsync = promisify(rename)

async function movingFile(imagePath: string, from: string, to: string): Promise<void> {
    try {
        const fileName = basename(imagePath)
        const imagePathTemp = join(from, fileName)
        const imagePathPermanent = join(to, fileName)
        
        // Проверяем существование исходного файла
        if (!existsSync(imagePathTemp)) {
            throw new Error(`Файл не найден: ${imagePathTemp}`)
        }
        
        // Перемещаем файл асинхронно
        await renameAsync(imagePathTemp, imagePathPermanent)
        
        console.log(`Файл перемещен: ${imagePathTemp} -> ${imagePathPermanent}`)
        
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Ошибка перемещения файла: ${error.message}`)
        } else {
            throw new Error('Неизвестная ошибка при перемещении файла')
        }
    }
}

export default movingFile
