#!/bin/bash
echo "Testing Login API..."
RESPONSE=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.trader@example.com","password":"User@123"}')
echo "Login Response: $RESPONSE"

echo ""
echo "Testing Register API..."
TIMESTAMP=$(date +%s)
RESPONSE=$(curl -s -X POST http://localhost:4001/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"username\":\"testuser$TIMESTAMP\",\"email\":\"test.$TIMESTAMP@example.com\",\"password\":\"Test@123\"}")
echo "Register Response: $RESPONSE"
