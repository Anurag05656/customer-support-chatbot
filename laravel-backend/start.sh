#!/bin/bash
# Clear build-time config cache and rebuild with runtime env vars
php artisan config:clear
php artisan route:clear
php artisan config:cache
php artisan route:cache

# Start the server
php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
