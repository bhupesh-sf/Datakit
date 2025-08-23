# Use official nginx alpine image (lightweight)
FROM nginx:alpine

LABEL maintainer="DataKit Team <amin@datakit.page>"
LABEL description="DataKit - Modern web-based data analysis tool"
LABEL version="0.3.92"

RUN rm -rf /usr/share/nginx/html/*

COPY dist/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set proper permissions (nginx:alpine already has nginx user)
RUN chown -R nginx:nginx /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Copy environment injection script
COPY inject-env.sh /usr/local/bin/inject-env.sh
RUN chmod +x /usr/local/bin/inject-env.sh

# Start with environment injection
CMD ["/usr/local/bin/inject-env.sh"]