using System.Security.Cryptography;
using System.Text.Json.Serialization;
using StackExchange.Redis;

// Source-generated JSON context for AOT compatibility
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(SimpleResponse))]
[JsonSerializable(typeof(CreatedCodeRecord))]
[JsonSerializable(typeof(ReadCodeRecord))]
[JsonSerializable(typeof(CreateCodeResponse))]
[JsonSerializable(typeof(ReadCodeResponse))]
[JsonSerializable(typeof(ErrorResponse))]
internal partial class AppJsonContext : JsonSerializerContext { }

// DTOs
internal record SimpleResponse(string Message);
internal record CreatedCodeRecord(
    long Id,
    string Code,
    [property: JsonPropertyName("created_at")] string CreatedAt
);
internal record ReadCodeRecord(
    string Id,
    string Code,
    [property: JsonPropertyName("created_at")] string CreatedAt
);
internal record CreateCodeResponse(
    [property: JsonPropertyName("created_code")] CreatedCodeRecord CreatedCode
);
internal record ReadCodeResponse(ReadCodeRecord Data);
internal record ErrorResponse(string Error);

internal class Program
{
    static readonly SimpleResponse SimpleHiResponse = new("hi");
    static readonly ErrorResponse NoCodesFoundResponse = new("No codes found.");
    static readonly ErrorResponse CodeAlreadyExistsResponse = new("Code already exists.");

    // Generate random code string (500 chars base64, matching Node.js implementation)
    static string GenerateCode()
    {
        // 375 bytes encodes to exactly 500 Base64 chars (same contract as Node.js path).
        Span<byte> bytes = stackalloc byte[375];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes);
    }

    static long _cachedMaxId;
    static long _lastCacheUpdateMs;

    static async Task<long> GetMaxIdAsync(IDatabase redis)
    {
        var now = Environment.TickCount64;
        if (now - _lastCacheUpdateMs > 500)
        {
            var maxIdRaw = await redis.StringGetAsync("codes:seq");
            if (!maxIdRaw.IsNullOrEmpty && long.TryParse(maxIdRaw.ToString(), out var parsed))
            {
                _cachedMaxId = parsed;
                _lastCacheUpdateMs = now;
            }
        }
        return _cachedMaxId;
    }

    static ReadCodeRecord ParseCodeRecord(HashEntry[] entries)
    {
        var id = string.Empty;
        var code = string.Empty;
        var createdAt = string.Empty;

        foreach (var entry in entries)
        {
            if (entry.Name == "id")
            {
                id = entry.Value.ToString();
            }
            else if (entry.Name == "code")
            {
                code = entry.Value.ToString();
            }
            else if (entry.Name == "created_at")
            {
                createdAt = entry.Value.ToString();
            }
        }
        return new ReadCodeRecord(id, code, createdAt);
    }

    static void Main(string[] args)
    {
        var builder = WebApplication.CreateSlimBuilder();

        // Disable logging completely
        builder.Logging.ClearProviders();

        var app = builder.Build();

        // Configure port (hardcoded to match other frameworks' approach)
        const int portNumber = 3004;
        var url = $"http://0.0.0.0:{portNumber}";

        // Initialize Redis connection at startup
        var redisHost = Environment.GetEnvironmentVariable("REDIS_HOST") ?? "localhost";
        var redisPort = Environment.GetEnvironmentVariable("REDIS_PORT");
        var redisConnectionString = redisPort != null ? $"{redisHost}:{redisPort}" : redisHost;
        var redisMultiplexer = ConnectionMultiplexer.Connect(redisConnectionString);
        var redis = redisMultiplexer.GetDatabase();

        Console.WriteLine($"C# server running at {url}");
        Console.WriteLine($"Redis connected to {redisConnectionString}");

        // GET /simple - Pure framework overhead test
        app.MapGet("/simple", () =>
        {
            return Results.Json(SimpleHiResponse, AppJsonContext.Default.SimpleResponse);
        });

        // POST /code - Match Node/Fastify behavior (uniqueness + seq + hash + queue)
        app.MapPost("/code", async () =>
        {
            var code = GenerateCode();
            var createdAt = DateTime.UtcNow.ToString("O"); // ISO 8601 format

            var isNew = await redis.SetAddAsync("codes:unique", code);
            if (!isNew)
            {
                return Results.Json(
                    CodeAlreadyExistsResponse,
                    AppJsonContext.Default.ErrorResponse,
                    statusCode: 409
                );
            }

            var id = await redis.StringIncrementAsync("codes:seq");
            await redis.HashSetAsync(
                $"codes:{id}",
                new[]
                {
                    new HashEntry("id", id),
                    new HashEntry("code", code),
                    new HashEntry("created_at", createdAt),
                }
            );
            await redis.ListLeftPushAsync("codes:sync_queue", id);

            var record = new CreatedCodeRecord(id, code, createdAt);
            return Results.Json(
                new CreateCodeResponse(record),
                AppJsonContext.Default.CreateCodeResponse,
                statusCode: 201
            );
        });

        // GET /code-fast - Match Node/Fastify behavior (cached max id + random hash read)
        app.MapGet("/code-fast", async () =>
        {
            var maxId = await GetMaxIdAsync(redis);
            if (maxId == 0)
            {
                return Results.Json(
                    NoCodesFoundResponse,
                    AppJsonContext.Default.ErrorResponse,
                    statusCode: 404
                );
            }
            var randomId = Random.Shared.NextInt64(1, maxId + 1);
            var entries = await redis.HashGetAllAsync($"codes:{randomId}");

            if (entries.Length == 0)
            {
                return Results.Json(
                    NoCodesFoundResponse,
                    AppJsonContext.Default.ErrorResponse,
                    statusCode: 404
                );
            }
            var record = ParseCodeRecord(entries);

            return Results.Json(
                new ReadCodeResponse(record),
                AppJsonContext.Default.ReadCodeResponse
            );
        });

        app.Run(url);
    }
}
