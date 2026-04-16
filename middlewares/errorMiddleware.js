import { STATUS_CODES } from '../utils/statusCodes.js';

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(STATUS_CODES.NOT_FOUND);
    next(error);
};

const errorHandler = (err, req, res, next) => {
    let statusCode = err.status || err.statusCode || res.statusCode;
    statusCode = statusCode === STATUS_CODES.OK ? STATUS_CODES.INTERNAL_SERVER_ERROR : statusCode;
    
    // Ensure we don't send status representing OK or redirects for an error
    if (statusCode < STATUS_CODES.BAD_REQUEST) statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR;

    res.status(statusCode);

    // If it's an API request, return JSON
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/api')) {
        return res.json({
            success: false,
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack
        });
    }

    // Use the auth layout for a clean, centered interface
    const layout = './layouts/auth';

    res.render('pages/error', {
        title: `${statusCode} Error`,
        message: err.message,
        statusCode: statusCode,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
        layout: layout
    });
};

export { notFound, errorHandler };
