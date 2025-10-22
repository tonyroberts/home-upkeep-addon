# Home Upkeep Add-on container
ARG BUILD_FROM

# -----------------------------
# Build front end
# -----------------------------
FROM node:24-slim AS node-builder

WORKDIR /app/frontend

# Copy frontend source and lock files
COPY frontend/package*.json /app/frontend/

# Install dependencies (rollup optional deps work on slim)
RUN npm ci

# Copy rest of frontend code
COPY frontend/ /app/frontend/

# Build production frontend
RUN npm run build

# -----------------------------
# Build back end
# -----------------------------
FROM ghcr.io/astral-sh/uv:latest AS uv
FROM python:3.14-alpine AS python-builder

# Install build tools and libraries for Python C extensions
RUN apk add --no-cache \
    python3-dev \
    py3-pip \
    build-base \
    musl-dev \
    linux-headers \
    libffi-dev \
    openssl-dev \
    bash

# Install UV into builder stage
COPY --from=uv /uv /uvx /bin/

# Build Python wheels
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked -v

# Copy rest of backend code
COPY backend/ /app/backend/

# Final stage provided by Home Assistant build system
FROM ${BUILD_FROM}

# Install Python runtime dependencies only
RUN apk add --no-cache python3 py3-pip libffi openssl bash

# Install nginx
RUN apk --no-cache add nginx && mkdir -p /run/nginx

# Install gettext, needed for nginx config substitution
RUN apk add --no-cache gettext

# Copy UV binary
COPY --from=uv /uv /uvx /bin/

# Install shared libs (node requires them)
RUN apk add --no-cache libstdc++ libgcc

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Copy backend from Python builder
WORKDIR /app/backend
COPY --from=python-builder /app/backend/ /app/backend/

# Fix up the venv
RUN uv venv .venv-new
RUN cp -r .venv/lib/python3.14/site-packages/* .venv-new/lib/python3.14/site-packages/
RUN rm -rf .venv
RUN mv .venv-new .venv
RUN source .venv/bin/activate

# Copy built frontend from Node builder
WORKDIR /app/frontend
COPY --from=node-builder /app/frontend/dist /app/frontend/dist

# Copy rootfs for s6 overlay
COPY rootfs /
