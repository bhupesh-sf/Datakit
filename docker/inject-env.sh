#!/bin/sh

# Inject environment variables into index.html
if [ -n "$VITE_CUSTOM_LOGO_URL" ]; then
    # Add script tag to inject custom logo URL
    sed -i "s|</head>|<script>window.CUSTOM_LOGO_URL='$VITE_CUSTOM_LOGO_URL';</script></head>|g" /usr/share/nginx/html/index.html
    echo "Custom logo URL injected: $VITE_CUSTOM_LOGO_URL"
else
    echo "Using default branding"
fi

# Start nginx
nginx -g "daemon off;"