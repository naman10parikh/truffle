---
id: d07
category: infra
title: Pod eviction under node memory pressure
---

# Pod eviction under node memory pressure

When a node experiences memory pressure, the kubelet reclaims resources by
evicting lower-priority workloads to protect node stability. The scheduler then
reschedules the evicted workloads elsewhere. Eviction thresholds, QoS classes,
and priority all decide which workloads are reclaimed first. This is the
mechanism that frees a node when it runs low on available memory.
