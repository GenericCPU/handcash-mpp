# Security policy

## Supported versions

Security-relevant fixes are published for the **current major** release line on npm. Upgrade to the latest minor/patch in that line when advisories are issued.

## Reporting a vulnerability

Please use the repository’s **GitHub Security Advisories** (private disclosure) if you believe you have found a security issue in this package.

For general integration questions (webhook verification, secret handling, replay controls), see [README.md](./README.md) (*Production readiness*) and [ARCHITECTURE.md](./ARCHITECTURE.md).

## Integration hygiene (library consumers)

- **Receipt and binding secrets:** Use **cryptographically random** strings at least **32 characters** (see `assertMinMppSecretLength` in the public API). Short or predictable HS256 / HMAC keys weaken receipts and challenge binding.
- **Webhook bodies:** HandCash payment-request completion payloads include **`appSecret`**. Verify with **`verifyPaymentRequestCompletedWebhook`**, then **do not log** raw bodies in production aggregators where logs might leak.
- **Replay and idempotency:** `MemoryJwtReplayGuard` and `MemoryIdempotencyStore` are **single-process**. Multi-instance production requires **shared** stores (e.g. Redis) with the same semantics.
- **Reference demo:** `examples/handcash-mpp-demo` includes **`POST /demo/complete`** to simulate settlement when Cloud cannot reach your laptop. It is **off in `NODE_ENV=production`** unless **`ALLOW_DEMO_COMPLETE=1`**. Do not copy that route into production services without equivalent controls.
