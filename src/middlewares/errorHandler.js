import constants from '../constants/httpStatus.js';

const errorHandler = (err, req, res, next) => {
    const statusCode =
        res.statusCode === constants.OK
            ? err.statusCode || constants.SERVER_ERROR
            : res.statusCode;
    const message = err.message || 'Server Error';
    const stackTrace = err.stack || null;

    return res.status(statusCode).json({
        statusCode,
        message,
        stackTrace
    });
};

export default errorHandler;
