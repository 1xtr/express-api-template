FROM node:lts-alpine
COPY . /app
WORKDIR /app
RUN npm install --omit=dev
RUN mkdir "tmp"
RUN mkdir "upload"
CMD ["npm", "run", "prod:start"]
