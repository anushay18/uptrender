#!/bin/bash
cd /Users/muskansingh/Desktop/Uptrender/backend
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=algo
export DB_USER=root
export DB_PASSWORD='Muskan@123'
export NODE_ENV=development
export PORT=4001
export JWT_SECRET=your_super_secret_jwt_key_here_production_change_this
export JWT_EXPIRES_IN=24h
export REDIS_HOST=localhost
export REDIS_PORT=6379
node server.js
