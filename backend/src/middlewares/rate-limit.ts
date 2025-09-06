import  rateLimit  from 'express-rate-limit'

const limiter = rateLimit({
    windowMs: 5 * 60 * 1000,  // 15 минут
    max: 30,
    statusCode: 429,
    // skipSuccessfulRequests: true, // Не считать успешные запросы
    message: 'Слишком много попыток, попробуйте через 15 минут',
})

export default limiter
