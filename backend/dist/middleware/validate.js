"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            success: false,
            error: 'INVALID_PAYLOAD',
            message: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
        return;
    }
    req.body = result.data;
    next();
};
exports.validate = validate;
