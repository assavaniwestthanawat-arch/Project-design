# SBP AirCare server API (Rev.10)

One endpoint: `POST /exec` (alias `/api/exec`), JSON body sent as `Content-Type: text/plain;charset=utf-8`.
The reply is always HTTP 200 JSON, either `{ok:true, …}` or `{ok:false, error:<code>}`; the client never looks at the HTTP status (`assets/ticket.js call()`).
`GET /exec` returns `{ok:true, service, version}`. `GET /healthz` returns `{ok, version, uptimeS, outboxPending}` for uptime monitors.

The **Apps Script contract is kept as-is** (`backoffice/apps-script/Code.gs`): `create`, `track`, `slots`, `list` and `update`. Additions are listed below.

## Public actions

| action | body | reply |
|---|---|---|
| `create` | `{ticket}`. Contract as before. **New optional fields:** `ticket.rid` (8–64 chars `[A-Za-z0-9_-]`, idempotency key), `ticket.consentText` (the exact consent sentence shown). Quote lines may carry `key, group, kind, units, per, pkg, level, spec`, and `quote.zoneInput` may be sent. | `{ok, id, status, statusTh}`; a repeated rid from the same phone within 24 h returns the same id plus `repeat:true` |
| `track` | `{id, tel}` | `{ok, ticket:{id, status, statusTh, kind, service, prefDate, slot, schedDate, schedSlot, team, payment?}}` |
| `slots` | `{from, days}` | unchanged |
| `pay` | `{id, tel, req, method:'promptpay'\|'transfer'\|'onsite'\|'gateway'}` | `{ok, pay:{req, kind, kindTh, amount, amountTh, ref, payee, expiresAt, method, …}}`. Method-specific fields: promptpay → `payload, qr` (data:image/svg+xml URL), `promptpay` (masked id); transfer → `bank:{name, accountName, accountNo}`; gateway → `qr, charge` |
| `paid` | `{id, tel, req, method:'promptpay'\|'transfer', reference?, note?}` | `{ok, payment}`. The customer reports a transfer, which is stored as SUBMITTED until staff verify it |
| `login` | `{user, password}` | `{ok, token, name, role:'admin'\|'staff'\|'tech', roleTh}`. The token is a 12-hour session |
| `logout` | `{token}` | `{ok}` |

`ticket.payment` (public view) is present only once the office has asked for money:

```
{status:'unpaid'|'partial'|'paid'|'overpaid'|'refunded'|'part_refunded'|'none', statusTh,
 due, paid, refunded,                      // baht
 pending:bool,                             // a reported transfer is waiting for verification
 methods:['gateway'?,'promptpay'?,'transfer'?,'onsite'?],
 payee,
 requests:[{id, kind, kindTh, amount, remaining, status:'open'|'paid'|'expired', statusTh, ref, expiresAt, submitted:bool}],
 receipts:[{no, amount, at, method}]}
```

## Staff actions

Every staff action takes `{token, staff?}`. `token` is either the session token from `login` or the legacy `STAFF_TOKEN`; with the legacy token the role is admin and the name comes from the `staff` field.

| action | body | reply |
|---|---|---|
| `list` | `{status?, since?, limit?}` | contract as before. Each ticket also carries `priceCheck:{verified, match, payable, issues}` and `pay:{status, statusTh, due, paid, refunded, asked, pending, open}` (baht) |
| `update` | `{id, patch, staff}` | contract as before. History `by` is the logged-in person's name |
| `me` | — | `{ok, name, role, roleTh}` |
| `paydetail` | `{id}` | `{ok, id, summary, suggested:{amount, basis, tax, totalEx, vat}\|null, quote (server recompute), payee, methods:{key:th}, kinds:{key:th}, requests[], payments[], refunds[], can:{request, verify, refund}}`. All amounts are in baht |
| `payreq` | `{id, kind:'full'\|'deposit'\|'balance'\|'extra', amount?:'1500.00', note?}` | same shape as paydetail. Omitting `amount` uses `suggested`; if there is no suggestion → `amount_required` |
| `payvoid` | `{req, reason}` | paydetail |
| `payrecord` | `{id, req?, method:'cash'\|'transfer'\|'promptpay'\|'edc'\|'cheque'\|'other', amount, reference?, note?}` | paydetail. admin/staff → verified at once with a receipt number; tech → submitted |
| `payverify` | `{payment, decision:'verify'\|'reject', amount?, note?}` | paydetail. admin/staff only |
| `refund` | `{id, payment?, amount, method:'transfer'\|'cash'\|'promptpay'\|'gateway'\|'other', reference?, reason}` | paydetail. admin only. Rejected with `refund_too_large` when the amount exceeds paid − refunded |

Rev.10 UX: `payreq`, `payvoid`, `payrecord`, `payverify` and `refund` accept an optional `rid` (8–64 chars `[A-Za-z0-9_-]`, one per opened money form on the board). The same staff account sending the same action with the same `rid` again — a retry after a timeout — gets the stored reply plus `repeat:true` instead of a second request / payment / receipt / refund (table `idem`, migration 3, kept 2 days; only successful replies are stored). Every successful reply of these five actions also carries `created`: the id of the request / payment / refund it created or acted on. `list` → `pay` also carries `unasked` (what the server quote still leaves to ask for, baht) and `refs` (request reference codes + receipt numbers, for the board's search).

## Error codes

**Existing:** `too_large bad_json unknown_action server rejected bad_kind bad_tel bad_name no_consent bad_email bad_date rate_limited not_found staff_disabled unauthorized bad_status bad_team`

**New:**

| code | meaning |
|---|---|
| `pay_closed` | the request was paid, voided or expired |
| `pay_unavailable` | that method is not configured |
| `bad_method` | |
| `bad_amount` | |
| `amount_required` | |
| `forbidden` | the role is not allowed to do this |
| `ticket_cancelled` | |
| `has_payments` | |
| `bad_decision` | |
| `reason_required` | |
| `refund_too_large` | |
| `gateway_error` | |

`server` replies carry `ref`, which matches the server log; internal messages are never sent.

## Server-side pricing

`quoteTotalEx`, `travelFee`, `zoneTier` and `quoteLines` are the server's figures, computed by `assets/sbp-core.js` over `assets/sbp-data.json`. The browser's figures are kept in `quoteJson.client`. `priceCheck.payable` means every line is priced, there are no survey items, the area is known, and there are no products and no annual contract. Only then does `payreq` fill in the amount by itself.
