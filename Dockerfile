FROM node:22-alpine

WORKDIR /srv
COPY server.js ./
COPY app/ ./public/

ENV PORT=8080 DATA_DIR=/data PUBLIC_DIR=/srv/public NODE_ENV=production
EXPOSE 8080

# Laeuft ohne Root. Wichtig: das gemountete ./data-Verzeichnis auf dem
# Host muss demselben Benutzer gehoeren -> siehe README.
RUN mkdir -p /data && chown -R node:node /data /srv
USER node

# /api/health meldet 503, sobald die Daten nicht les- oder schreibbar
# sind; --spider wertet den HTTP-Status aus.
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "server.js"]
