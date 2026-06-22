---
id: d05
category: security
title: Authentication and authorization basics
---

# Authentication and authorization basics

Authentication proves who a user is; authorization decides what they may do.
A typical flow issues a signed token (JWT) after login, then checks that token's
claims on each request. Keep secrets out of the client, rotate signing keys, and
scope tokens to the minimum permissions. This document is about auth, not search.
