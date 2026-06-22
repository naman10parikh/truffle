---
id: d08
category: infra
title: Remove containers and images to reclaim disk
---

# Remove containers and images to reclaim disk

To reclaim disk you can remove stopped containers and dangling images. Run
`docker container prune` to remove containers and `docker image prune` to remove
images. This frees disk space, not memory — it is about housekeeping a host's
storage, and mentions remove, containers, and memory only in passing. It does
not evict running workloads.
