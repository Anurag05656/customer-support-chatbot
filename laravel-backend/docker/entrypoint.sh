#!/bin/bash
set -e

echo "==> Running entrypoint..."

# Generate APP_KEY if not set
if [ -z "$APP_KEY" ]; then
    echo "==> Generating APP_KEY..."
    php artisan key:generate --force
fi

# Cache configuration for performance
echo "==> Caching config..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run database migrations
echo "==> Running migrations..."
php artisan migrate --force

echo "==> Starting services..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
