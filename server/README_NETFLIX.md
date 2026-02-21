# Netflix NFToken Route

This replaces any previous makizig-based fetch. The server now calls
Netflix's **own** GraphQL API directly — no third-party proxy involved.

## Endpoint

```
POST /api/netflix/generate-token
Content-Type: application/json
```

### Request body

```json
{
  "cookies": "<cookies in any supported format>"
}
```

Supported `cookies` values:

| Format | Example |
|---|---|
| Raw cookie string | `"NetflixId=abc; SecureNetflixId=xyz; nfvdid=def"` |
| Browser-extension JSON | `[{"name":"NetflixId","value":"abc"}, ...]` |
| Netscape (tab-separated) | TSV file contents as a string |
| Flat JSON object | `{"NetflixId":"abc","SecureNetflixId":"xyz","nfvdid":"def"}` |

Required cookie keys: **`NetflixId`**, **`SecureNetflixId`**, **`nfvdid`**

### Success response

```json
{
  "success": true,
  "token": "<nftoken string>",
  "watchLink": "https://netflix.com/?nftoken=<token>"
}
```

### Error response

```json
{
  "success": false,
  "error": "<message>",
  "details": "<optional extra info>"
}
```

## How it works

1. Cookie input is parsed into a `{key: value}` dict.
2. A POST is sent to `https://android13.prod.ftl.netflix.com/graphql` with
   the persisted query `CreateAutoLoginToken` (scope: `WEBVIEW_MOBILE_STREAMING`).
3. The returned `createAutoLoginToken` string is formatted as
   `https://netflix.com/?nftoken=<token>`.

## Registering the route in `server/index.ts`

```ts
import netflixRouter from './netflix';

// Remove any old makizig route if present, then add:
app.use('/api/netflix', netflixRouter);
```
