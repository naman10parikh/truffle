---
id: d06
category: infra
title: Running services in Docker containers
---

# Running services in Docker containers

Docker packages an application and its dependencies into an image that runs as a
container. A Dockerfile declares the build steps; `docker run` starts a container
from the image. Containers are the unit that Kubernetes schedules onto nodes, so
Docker and Kubernetes are commonly used together in an infra stack.
