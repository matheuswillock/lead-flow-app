FROM node:22-alpine

RUN apk add --no-cache docker-cli docker-cli-compose tar gzip wget

WORKDIR /app
COPY server.ts ./server.ts

ENV OPS_AGENT_HOST=0.0.0.0
ENV OPS_AGENT_PORT=9090
ENV OPS_DEPLOY_DIR=/opt/lead-flow-bot

EXPOSE 9090
HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:9090/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "server.ts"]
