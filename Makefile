REGISTRY ?= vibesurvival.azurecr.io
TAG ?= latest
CLIENT_IMAGE = $(REGISTRY)/vibesurvival-client:$(TAG)
AUTH_SERVER_IMAGE = $(REGISTRY)/vibesurvival-auth-server:$(TAG)
SPACETIME_SERVER_IMAGE = $(REGISTRY)/vibesurvival-spacetime-server:$(TAG)

PLATFORMS = linux/amd64,linux/arm64

.PHONY: all build push

all: build push

# Requires Docker Buildx (docker buildx create --use)
build:
	docker buildx build --no-cache --platform=$(PLATFORMS) -t $(CLIENT_IMAGE) . --push
	docker buildx build --no-cache --platform=$(PLATFORMS) -t $(AUTH_SERVER_IMAGE) ./auth-server-openauth --push
	docker buildx build --no-cache --platform=$(PLATFORMS) -t $(SPACETIME_SERVER_IMAGE) ./server --push

push:
	echo "Images are pushed during buildx build with --push. No separate push step needed." 