# Algo Trading Backend

Node.js + Express backend for the Algorithmic Trading Platform.

## Features
- **Authentication**: JWT-based auth with registration/login
- **Real-time Communication**: Socket.IO for live trade/strategy updates
- **Rate Limiting**: Prevents abuse with configurable limits
- **Security**: Helmet for headers, CORS, input validation
- **Database**: MySQL with Sequelize ORM
- **Middleware**: Error handling, logging, authentication

## Setup

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment Variables**:
   Copy `.env` and update values:
   ```
   PORT=5000
   DB_HOST=localhost
   DB_NAME=algo_trading_db
   DB_USER=your_user
   DB_PASSWORD=your_password
   JWT_SECRET=your_secret
   ```

3. **Database**:
   - Ensure MySQL is running
   - Run the schema from `../database/schema.sql`
   - Or use Sequelize migrations

4. **Start Server**:
   ```bash
   npm run dev  # Development with nodemon
   npm start    # Production
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh JWT
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users` - Admin: List all users

### Trades
- `GET /api/trades` - Get user trades
- `POST /api/trades` - Create trade

### Strategies
- `GET /api/strategies` - Get user strategies
- `POST /api/strategies` - Create strategy
- `GET /api/strategies/marketplace` - Public strategies

### API Keys
- `GET /api/apis` - Get user API keys
- `POST /api/apis` - Add API key

### Dashboards
- `GET /api/dashboards/summary` - Dashboard data

## Real-time Events (Socket.IO)

- `join` - Join user room
- `subscribe-trades` - Subscribe to trade updates
- `subscribe-strategies` - Subscribe to strategy updates

## Project Structure
```
backend/
├── src/
│   ├── controllers/     # Business logic
│   ├── models/         # Sequelize models
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── config/         # Database config
│   ├── utils/          # Helpers (JWT, etc.)
│   └── app.js          # Express app setup
├── .env                # Environment variables
├── server.js           # Server entry point
└── package.json
```

## Development
- Use `npm run dev` for auto-restart
- Models auto-sync in development
- Error logs in console
- Health check at `/health`

## Security
- Password hashing with bcrypt
- JWT tokens with expiration
- Rate limiting (100 req/15min)
- Input validation with express-validator
- CORS configured for frontend
- Helmet for security headers

## Next Steps
1. Implement full controllers with database operations
2. Add comprehensive validation
3. Implement real-time broadcasting
4. Add file upload for avatars/documents
5. Add email verification
6. Add unit tests