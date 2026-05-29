# Floe Application Notes

## What the agent does

This is an onchain market/risk research agent. It takes a token, wallet, or protocol-style query, checks free public market data first, then uses paid x402 APIs under a strict per-task budget to fill in missing context. For the demo it uses DEX Screener as the free source, then pays through Floe for StableEnrich Exa search for web/protocol context, x402.twit.sh X/Twitter search for market chatter, and OnchainExpat token metadata for contract/security context when a token address is available. It records every paid decision with estimated cost, final status, provider, URL, and receipt metadata so the final research brief includes a payment trace instead of hiding spend inside the agent.

## What I wish the payment layer did differently

- Better vendor discovery: agents should be able to search available x402 APIs by capability, price, freshness, and historical reliability before picking a vendor.
- Standardized receipt schema: every paid response should expose consistent fields for amount, token, network, settlement id, vendor, and request fingerprint.
- Richer preflight metadata: cost estimates should include latency, expected response shape, freshness window, and whether the request is likely to satisfy the agent's information need.

## Framework

Custom TypeScript CLI with fetch-based clients, Floe/x402 payment gating, and a small deterministic scoring layer. It can be wrapped as an MCP tool later, but the v1 demo is intentionally CLI-first for fast review.
