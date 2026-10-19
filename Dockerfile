FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY packages/inkan/starter/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/examples/company-decisions/dist /usr/share/nginx/html
EXPOSE 80
