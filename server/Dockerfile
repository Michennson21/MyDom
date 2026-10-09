FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=8080 DATABASE_PATH=/data/mydom.sqlite
EXPOSE 8080
CMD ["node", "server/server.mjs"]
