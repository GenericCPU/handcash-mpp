# Examples

| Directory | Description |
|-----------|-------------|
| [`handcash-mpp-demo/`](./handcash-mpp-demo/) | Runnable HTTP server: 402 challenge, HandCash Pay, Connect, receipt JWTs, optional webhook simulation. |

From the repository root, `cd examples/handcash-mpp-demo`, copy `.env.example` to `.env`, then `npm install` and `npm start`.

**Headless agent:** see **[handcash-mpp-demo/AGENTS.md](./handcash-mpp-demo/AGENTS.md)**. Quick refs: `npm run agent` (wait for pay + poll), `npm run agent:challenge` (print 402 JSON once for Cursor), `npm run agent:premium` with `MPP_RECEIPT_JWT` (print unlocked JSON once).
