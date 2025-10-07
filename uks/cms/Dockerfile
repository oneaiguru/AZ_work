FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./tsconfig.json
COPY config ./config
COPY public ./public
COPY src ./src

# Remove any API directories left over from prior builds that are no longer part of the codebase
RUN find ./src/api -mindepth 1 -maxdepth 1 -type d \
    ! -name 'document' \
    ! -name 'news-article' \
    ! -name 'page' \
    ! -name 'procurement' \
    ! -name 'project' \
    -exec rm -rf {} +

RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
