# Cursor Prompt — Ultra-Minimal C# Redis Benchmark Server

You are building an ultra-minimal high-performance C# web server using **.NET 10 Minimal API**, equivalent to the Express benchmark server shown below:

- ```GET /simple```
- ```POST /code```
- ```GET /code-fast```

The reference Express behavior comes from:

```js
GET /simple        → handleSimpleGet()
POST /code         → handleCodeCreate()
GET /code-fast     → handleCodeRead()
```

The goal is to reproduce the same benchmark-style endpoints in **C# + Redis**, optimized for:

- minimal CPU usage  
- minimal memory usage  
- maximum throughput  

---

## Requirements

### General Constraints

- Use **.NET 10 Minimal API**
- Do **NOT** use MVC or Controllers
- Do **NOT** use Entity Framework
- Do **NOT** use Swagger
- Do **NOT** enable unnecessary middleware
- Disable logging completely
- Keep code minimal and optimized for:
  - low CPU usage
  - low memory usage
  - high throughput
- Must be **Native AOT friendly**
- Use source-generated JSON (```JsonSerializerContext```)
- Use a single global Redis connection

---

## Redis Dependency

Use only:

- ```StackExchange.Redis```

Redis must be connected once at startup:

```csharp
ConnectionMultiplexer.Connect("localhost:6379");
```

Reuse the same connection for all requests.

---

## Endpoints to Implement

---

### 1️⃣ GET ```/simple```

Equivalent Express handler:

```js
export function handleSimpleGet() {
  return { message: "hi" };
}
```

C# response:

```json
{ "message": "hi" }
```

This endpoint is a pure framework overhead test and must be extremely low allocation.

---

### 2️⃣ POST ```/code```

Equivalent Express behavior:

- Create a new code record
- Store it in Redis
- Return HTTP ```201```

Express returns:

```json
{
  "created_code": { ... }
}
```

#### C# Implementation Requirements

- Generate a UUID for the record ID
- Generate a short random code string (example: ```ABC123```)
- Store JSON record in Redis

Key format:

```
code:{uuid}
```

Value format:

```json
{
  "id": "...",
  "code": "...",
  "created_at": "..."
}
```

Also push the ID into a Redis queue:

```
LPUSH codes:sync_queue:{shard}
```

Shard must be random ```1–100```, equivalent to:

```js
Math.floor(Math.random() * 100) + 1
```

Return HTTP ```201```:

```json
{
  "created_code": {
    "id": "...",
    "code": "...",
    "created_at": "..."
  }
}
```

No uniqueness check is required (ultra-fast version).

---

### 3️⃣ GET ```/code-fast```

Equivalent Express behavior:

```js
GET /code-fast → handleCodeRead()
→ returns random code record from Redis
```

#### Required Behavior

- Pick a random shard ```1–100```
- Read one ID from:

```
codes:sync_queue:{shard}
```

- Fetch the record from:

```
code:{id}
```

Return HTTP ```200```:

```json
{
  "data": {
    "id": "...",
    "code": "...",
    "created_at": "..."
  }
}
```

If nothing found:

HTTP ```404```

```json
{ "error": "No codes found." }
```

---

## Implementation Notes

- Keep everything in a single ```Program.cs```
- Use ```WebApplication.CreateSlimBuilder```
- Disable logging:

```csharp
builder.Logging.ClearProviders();
```

- Use synchronous Redis calls for lowest overhead
- Use source-generated JSON serialization
- Avoid ```async/await``` unless required

---

## Output Required

Generate:

1. Complete ```.csproj``` with Native AOT enabled
2. Complete ```Program.cs``` implementing all 3 endpoints
3. Instructions:

Run locally:

```bash
dotnet run
```

Publish Native AOT:

```bash
dotnet publish -c Release -r linux-x64 /p:PublishAot=true
```

---

## Notes

This is a benchmark-style server.  
Optimize for throughput and minimal allocations, similar to the Node 1M RPS Express example.

Build the full working code now.
