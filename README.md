# Minimal x402 Risk Research Agent

A small TypeScript CLI that checks free DEX Screener data first, then conditionally uses paid x402 enrichment through a Floe-compatible payment client. The output is designed for a short Loom: target, free checks, spend decision, paid enrichment, risk brief, and payment trace.

## Setup

```bash
npm install
cp .env.example .env
```

For a no-spend demo:

```bash
DRY_RUN=true npm run demo -- --chain base --target 0x4200000000000000000000000000000000000006 --budget 0.05
```

Use a token contract address for specific reports. Symbol/name queries are supported as best-effort DEX Screener searches, but short symbols like `eth` can be ambiguous and may produce broad paid-search context.

For a real paid run, export a Floe **agent key** and leave `DRY_RUN` unset:

```bash
export FLOE_KEY=floe_YOUR_AGENT_KEY
npm run demo -- --chain base --target <token-or-protocol> --budget 0.05
```

You can also put `FLOE_KEY=...` in `.env`; the CLI loads `.env` automatically. Use the `floe_*` key from the dashboard's **Agent keys** section, not the `floe_live_*` developer key. `FLOE_API_KEY` and `FLOE_FACILITATOR_API_KEY` are also supported for compatibility. Make sure `.env` does not contain `DRY_RUN=true` when you want to spend.

The demo also supports Floe CLI-style agent scoped variables. If your key is stored under an agent name, either use `FLOE_KEY=...` or set:

```bash
FLOE_AGENT_NAME=research
FLOE_AGENT_KEY_RESEARCH__CREDIT_API_FLOELABS_XYZ=floe_YOUR_AGENT_KEY
```

If Floe provides a different proxy URL, set `FLOE_X402_PROXY_URL=...`; otherwise the CLI uses the documented `https://credit-api.floelabs.xyz/v1/proxy/fetch`.

To check key loading, Floe auth, and proxy reachability without exposing your secret:

```bash
npm run diagnose
```

To print the exact loaded runtime key and `.env` value while debugging locally:

```bash
npm run diagnose -- --show-key
```

To diagnose a named Floe CLI agent env fallback:

```bash
npm run diagnose -- --agent research
```

## How It Works

1. Resolves the target as a token address or search phrase.
2. Pulls free DEX Screener token/pair data.
3. Scores basic market risk from liquidity, volume, pool age, pair count, and price action.
4. If confidence is low, preflights paid enrichments against the budget: Exa web search, x402.twit.sh X/Twitter search, and OnchainExpat token metadata when a nonzero EVM token address is available.
5. In `DRY_RUN=true`, returns deterministic mock enrichment and trace rows.
6. In real mode, uses the local Floe SDK-style client in `src/clients/floe.ts`, which POSTs through Floe's documented `https://credit-api.floelabs.xyz/v1/proxy/fetch` using `FLOE_KEY`.

The public `@floe/x402` package shown in the dashboard playground was not available on npm when this demo was built, so `src/clients/floe.ts` mirrors that minimal `Floe` client shape while using the documented REST proxy underneath.
