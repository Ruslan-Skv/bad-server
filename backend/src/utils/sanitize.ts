import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const domPurify = DOMPurify(window);

export const sanitizeHtml = (dirty: string): string => {
    return domPurify.sanitize(dirty, {
        ALLOWED_TAGS: [], // Разрешаем только текст, никаких тегов
        ALLOWED_ATTR: [], // Запрещаем все атрибуты
        KEEP_CONTENT: true // Сохраняем текстовое содержимое
    });
};

export const sanitizeText = (text: string): string => {
    // Удаляем все HTML теги, оставляем только текст
    return text.replace(/<[^>]*>/g, '');
};
