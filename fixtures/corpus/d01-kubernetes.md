---
id: d01
category: infra
title: Deploying to Kubernetes
---

# Deploying to Kubernetes

Kubernetes orchestrates containers across a cluster. A Deployment manages a
ReplicaSet, which keeps a desired number of Pods running. Use `kubectl apply` to
roll out a new image; the control plane reconciles the actual state toward the
declared state. Kubernetes handles scheduling, self-healing, and rolling updates.
