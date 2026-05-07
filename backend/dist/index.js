"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cards_1 = __importDefault(require("./routes/cards"));
const vendors_1 = __importDefault(require("./routes/vendors"));
const tap_1 = __importDefault(require("./routes/tap"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const map_1 = __importDefault(require("./routes/map"));
const auth_1 = __importDefault(require("./routes/auth"));
const ai_1 = __importDefault(require("./routes/ai"));
const errors_1 = require("./middleware/errors");
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3000;
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        /\.vercel\.app$/,
        /\.up\.railway\.app$/,
        /\.onrender\.com$/
    ],
    credentials: true
}));
app.use(express_1.default.json());
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'Night Market API is running.' });
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/cards', cards_1.default);
app.use('/api/vendors', vendors_1.default);
app.use('/api/tap', tap_1.default);
app.use('/api/campaigns', campaigns_1.default);
app.use('/api', campaigns_1.default); // mounts /api/kiosk/tap
app.use('/api/map', map_1.default);
app.use('/api/ai', ai_1.default);
// 404
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found.' });
});
// Centralised error handler
app.use(errors_1.errorHandler);
app.listen(PORT, () => {
    console.log(`Night Market API running on http://localhost:${PORT}`);
});
exports.default = app;
