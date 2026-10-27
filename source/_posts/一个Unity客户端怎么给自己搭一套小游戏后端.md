---
title: 一个 Unity 客户端怎么给自己搭一套小游戏后端
date: 2026-10-27 23:00:00
tags:
  - Unity
  - 小游戏
  - 后端
  - ASP.NET Core
  - MongoDB
categories:
  - 后端
---

做客户端做了八年，一直有个习惯：拿到需求先想「这块归谁做」。云存档归后端，排行榜归后端，邀请归后端。直到自己独立做一款消除小游戏，才发现这些「归后端」的东西加起来其实只有四个接口。

这篇文章记录我怎么给自己写了一套后端。没有架构图，没有高并发，就是把一款体量不大的小游戏真正需要的服务端，从零写到上线。C# 服务端代码不到一千行，其中控制器占了一大半。

如果你是客户端，手上有一款小游戏，正在纠结「要不要接个现成的后端服务」，这篇大概能帮你判断。

## 起点：客户端缺的，其实是四件小事

先把需求剥干净。一款微信 / 抖音双端上线的消除游戏，去掉运营后台、去掉支付，客户端真正需要服务端的只有：

| 能力 | 为什么必须有 | 请求频率 |
| --- | --- | --- |
| 登录换 openid | 客户端拿不到 openid，只能拿 code | 每次启动 |
| 云存档 | 换手机、清缓存、在小游戏端和 App 端之间同步进度 | 进游戏一次、过关若干次 |
| 世界排行榜 | 本地存不了全服数据 | 打开榜单面板 |
| 配置下发 | 关卡数值、活动开关不发版就能改 | 每次启动 |

再加一个辅助的：邀请关系链（谁邀请了谁、邀请了几次）。这个是运营需求，不是技术需求。

就这些。没有实时对战，没有房间匹配，没有排行榜的毫秒级刷新。

**这里有个判断很关键**：不要把「云存档」理解成一个功能模块，它就是「把本地那份存档搬到服务器，加一个用户 ID 做键」。想清楚这点，整个后端的规模就清楚了 —— 这是一个四张表的小系统，不是一个「服务端」。

## 为什么我没用现成的后端服务

微信云开发、LeanCloud、Firebase 都是正经选择，快速上线完全够。我没用，三个理由：

**一是我要存的东西是二进制。** 我的存档是 MemoryPack 序列化出来的 `byte[]`，不是 JSON。塞进 JSON 风格的文档数据库要 base64 包一层，体积涨三分之一；MongoDB 的 BSON 有 `BinData` 类型，`byte[]` 直接存进去，来回都不用转。

**二是我要两个渠道用同一套后端。** 微信用 `jscode2session`，抖音用另一套，两边 openid 体系完全不同。这套逻辑自己写反而比在 PaaS 里找对应能力简单。

**三是我本来就熟 C#。** 这是最真实的一条。

代价也说清楚：现成的服务帮我省掉「部署、运维、扩容」，自己写就全接回来了。文章后面有一节专门列了我省掉的东西（包括该做而没做的），你可以看完再决定。

## 选型：C# 全栈 + MongoDB + MemoryPack

三个选择，每个都只为了一件事：让客户端写起来的心理负担最小。

**服务端用 ASP.NET Core（.NET 8）。** 客户端是 C#，服务端也是 C#，数据模型两边各写一份同结构的类就行，不用在 C# 和 JS 之间翻译一遍字段名。这一点在调试时价值最大 —— 出问题时你只需要在一个语言的栈里找。

**数据库用 MongoDB。** 我的数据形态是「一个用户一条记录，里面是一坨二进制 + 几个可查询的标量字段」。这就是文档库的形状。用关系库的话那张表只有一个 id、一个 blob、一个 int，还要建表、还要 ORM 映射，纯属负担。而且 MongoDB 可以和服务装在同一台机器上，省掉一次网络往返和一份运维。

**序列化用 MemoryPack。** 这个后面单开一节说，它既是性能选择，也是这套架构里最省事的部分 —— 客户端本来就有这个库。

技术栈的版本是：`net8.0`、`MemoryPack 1.21.1`、`MongoDB.Driver 2.28.0`、`Swashbuckle.AspNetCore 6.4.0`（Swagger，只给开发期用）。

## 工程骨架：Program.cs 不到 50 行

整个服务端的入口就这些：

```csharp
var builder = WebApplication.CreateBuilder(args);

// 三个配置节：数据库、微信、抖音
builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection(nameof(DatabaseSettings)));
builder.Services.Configure<WeChatSettings>(
    builder.Configuration.GetSection(nameof(WeChatSettings)));
builder.Services.Configure<DouYinSettings>(
    builder.Configuration.GetSection(nameof(DouYinSettings)));

// Mongo 连接做成单例，启动时建索引
builder.Services.AddSingleton<MongoDbService>();

// 服务端要主动去调微信/抖音的接口，所以需要 HttpClient
builder.Services.AddHttpClient();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 挂在 IIS 后面，拿真实 IP 和协议
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.Run();
```

三个点值得单独说：

`AddSingleton<MongoDbService>()` —— 连接池是长连接资源，做成单例，一次建、全局复用。Scoped 会让每个请求都新建一次 `MongoClient`，那是灾难。

`UseForwardedHeaders` —— 挂在 IIS 或反代后面时，`HttpContext.Connection.RemoteIpAddress` 拿到的是 127.0.0.1 也就是反代自己。不加这段，你所有日志里的 IP 都是本机，以后想查「同一 IP 刷了多少次」就永远查不到。

`IsDevelopment()` 才开 Swagger —— 上线后 Swagger 页面是一个免费的接口地图，不该暴露给外面。

**整个项目没有一行鉴权代码。** `app.UseAuthorization()` 在那里，但没有任何 `[Authorize]`。这是个真实的缺口，最后一节会讲清楚它的后果和补法。

本机 `dotnet run` 起来之后，`/swagger` 就是这个样子 —— 六个 Controller，十七个接口，全部没有锁标：

![Swagger 接口总览](/images/swagger-overview.png)

注意 `GameConfig` 那三行：`GET /GameConfig`、`POST /GameConfig`、`GET /GameConfig/GameConfig`。这是我在同一个 Controller 上挂了两个 `[HttpGet]`，路由撞了，只能手动指定 `[HttpGet("Config")]` 区分。能用，但丑。这个后面还会提到。

## 配置与密钥：唯一必须一次做对的事

```json
// appsettings.example.json —— 这个文件进仓库
{
  "DatabaseSettings": {
    "ConnectionStrings": "mongodb://user:password@localhost:27017/GameDatabase",
    "DatabaseName": "GameDatabase"
  },
  "WeChatSettings": {
    "AppId": "",
    "AppSecret": ""
  },
  "DouYinSettings": {
    "AppId": "",
    "AppSecret": ""
  }
}
```

仓库里只放 `appsettings.example.json`，真正的 `appsettings.json` 和 `appsettings.Production.json` 进 `.gitignore`，在服务器上手工放。

这不是洁癖。**`AppSecret` 泄露等于别人可以冒充你的小程序去换 openid**，也能直接调你的服务端接口。小游戏的 AppSecret 泄露在圈子里不是新闻。

同理，日志里永远不要打印 `ConnectionStrings`。我一开始在 `Program.cs` 里写了段调试代码把连接串 `Console.WriteLine` 出来，上线前注释掉了 —— 那种东西只要进过一次日志文件，就得改密码。

## 数据建模：五张表

```
PlayerDatas       存档（UserId → 二进制存档）
RankData          排行榜（UserId → 关卡进度、昵称、头像）
UserInfoData      登录信息（UserId → session_key、邀请关系、邀请次数）
GameConfigData    关卡配置（Version → 二进制配置）
CommonConfigData  通用配置（Version → 二进制 + 服务器时间）
```

第六张 `PropConfigData` 在代码里定义了、Controller 也写了，但到现在为止没往里放过一条数据 —— MongoDB 里根本没有这个集合，索引也没建。所以实际跑起来的只有上面五张。下面这张 Compass 截图就是它的真面目：5 个集合，`PlayerDatas` 里八千多条存档，2 个索引（`_id` 主键 + `UserId` 唯一索引）。

![MongoDB Compass 里的实际集合](/images/mongodb-compass.png)

注意 `Data` 那一栏的值：`Binary.createFromBase64('BUF//8cAAAB...')`。这就是全篇最关键的一个视觉确认 —— 我在 C# 里传的是 `byte[]`，MongoDB 存的是 BSON 的 **BinData**，不是 base64 字符串、不是 JSON。客户端序列化出来多大，落到库里就多大。

每一张表都只有一个唯一索引，建在业务主键上：

```csharp
public MongoDbService(IOptions<DatabaseSettings> settings)
{
    var client = new MongoClient(settings.Value.ConnectionStrings);
    _database = client.GetDatabase(settings.Value.DatabaseName);
    CreateIndexes();
}

public IMongoCollection<PlayerData> PlayerDatas =>
    _database.GetCollection<PlayerData>("PlayerDatas");

private void CreateIndexes()
{
    var indexModel_PlayerData = new CreateIndexModel<PlayerData>(
        Builders<PlayerData>.IndexKeys.Ascending(x => x.UserId),
        new CreateIndexOptions { Unique = true });
    PlayerDatas.Indexes.CreateOne(indexModel_PlayerData);
    // 其余四张同理
}
```

两个踩过的点：

**唯一索引不是性能优化，是数据正确性。** 我的写入路径是「先查有没有，有就 Replace，没有就 Insert」。这不是原子操作，并发下两次请求都查到「没有」，就会插进两条同一个 `UserId` 的记录，之后每次查存档都可能拿到旧的那条。加了唯一索引之后，第二次 Insert 会直接抛异常 —— 虽然还是报错，但至少数据不会静默损坏。真正干净的做法是 `ReplaceOneAsync(..., new ReplaceOptions { IsUpsert = true })`，一步到位。

**建索引放在构造函数里，意味着 Mongo 连不上时服务启动就抛异常。** 这是我想要的行为（起不来比带病运行好），但它也意味着：数据库维护期间重启服务端，站点会直接 500。知道这点，重启顺序就不会错 —— 先起 Mongo，再起站点。

还有一个历史包袱：

```csharp
// 沿用旧集合名，避免已有玩家数据迁移
public IMongoCollection<UserInfoData> UserInfoData =>
    _database.GetCollection<UserInfoData>("WXInfoData");
```

类叫 `UserInfoData`，集合叫 `WXInfoData`，因为一开始只接了微信，后来加抖音时不想写迁移脚本。这种不一致会一直恶心自己，但比起在已有真实玩家的数据上做迁移，我认了。**如果你还没上线，请当场改名。**

## 登录：客户端只能拿 code

这是小游戏后端最容易写错的一环，核心只有一句：**`AppSecret` 永远不能出现在客户端**。所以流程必然是：

```
客户端调 wx.login / tt.login 拿到 code
        ↓
把 code 发给自己的服务端
        ↓
服务端带上 AppSecret 去平台换 openid + session_key
        ↓
服务端存 openid，把 openid 返回客户端
```

微信是 GET 查询串，抖音是 POST JSON —— 两个平台连请求形状都不一样：

```csharp
[HttpGet]
public async Task<IActionResult> Login(string code, string platform = "wechat")
{
    if (string.IsNullOrEmpty(code)) return BadRequest("code is empty");
    if (string.Equals(platform, "douyin", StringComparison.OrdinalIgnoreCase))
        return await LoginDouYin(code);
    return await LoginWeChat(code);
}

private async Task<IActionResult> LoginWeChat(string code)
{
    string url = $"https://api.weixin.qq.com/sns/jscode2session" +
                 $"?appid={_weChatAppId}&secret={_weChatAppSecret}" +
                 $"&js_code={code}&grant_type=authorization_code";
    var client = _clientFactory.CreateClient();
    var response = await client.GetAsync(url);
    var content = await response.Content.ReadAsStringAsync();

    var loginInfo = JsonSerializer.Deserialize<WeChatLoginInfo>(content);
    if (loginInfo == null || string.IsNullOrEmpty(loginInfo.openid)
        || string.IsNullOrEmpty(loginInfo.session_key))
        return BadRequest(content);

    await SaveLoginInfo(loginInfo.openid, loginInfo.session_key);
    return Content(loginInfo.openid, "text/plain");   // 只回 openid
}
```

几个当时想过的细节：

**`platform` 参数默认 `"wechat"`。** 不是设计得优雅，是为了兼容已经发出去的微信版客户端 —— 它们调这个接口时不会带 `platform`。加渠道参数那天，第一版必须能跑。

**`session_key` 存在服务端，不下发。** 客户端不需要它，给了它等于把「解密用户手机号」的能力也给出去了。现在存着其实是浪费（我没做手机号解密），但留着比删了安全 —— 万一以后要加。

**返回值只回一个纯文本 openid。** 不是 JSON，是 `text/plain`。它足够简单，简单到后来想在这个响应里多塞点东西时才发现不好改 —— 但一直没改。

`SaveLoginInfo` 是「查到了就 Replace，没查到就 Insert」，和存档一样的模式，这里也依赖那个唯一索引兜底。

顺带把接口分组的全景也放一张 —— 这张图里能看到后面几节要讲的几个接口长什么样：

![接口分组：PlayerData 三个动词，Rank 只有两个](/images/swagger-groups.png)

有两处值得盯着看：

`PlayerData` 上挂了 `GET` / `POST` / `DELETE` 三个动词加一个 `GET /PlayerData/Query`。前三个是给游戏用的，最下面那个 `Query` 是给我自己用的 —— 客服查档，按 `DbId` 反查存档。

`Login` 那一组里，`SetInviteId` 是 `POST`，`SetInviteTimes` 是 `GET`。同一个 Controller 里，两个「写操作」挂在了不同的动词上。这不是设计，是当时手滑。`GET /Login/SetInviteTimes` 这种东西留在代码里，等于每次有人看 Swagger 我都会被提醒一次。

## 云存档：把 `byte[]` 当黑盒

这是整套设计里我最满意的一点 —— **服务端不解析存档内容**。

```csharp
[HttpPost]
public async Task<IActionResult> UpdatePlayerData()
{
    using var memoryStream = new MemoryStream();
    await Request.Body.CopyToAsync(memoryStream);
    byte[] serializedData = memoryStream.ToArray();

    var playerDataIn = MemoryPackSerializer.Deserialize<PlayerData>(serializedData);
    if (playerDataIn == null) return BadRequest("The uploaded playerData is empty");
    if (string.IsNullOrEmpty(playerDataIn.UserId)) return BadRequest("UserId is required.");

    await UpdateRankData(playerDataIn.Data);   // 顺带更新排行榜

    var existingPlayer = await _mongoDbService.PlayerDatas
        .Find(p => p.UserId == playerDataIn.UserId).FirstOrDefaultAsync();

    if (existingPlayer != null)
    {
        playerDataIn.DbId = existingPlayer.DbId;
        await _mongoDbService.PlayerDatas
            .ReplaceOneAsync(p => p.UserId == playerDataIn.UserId, playerDataIn);
    }
    else
    {
        playerDataIn.DbId = ObjectId.GenerateNewId().ToString();
        await _mongoDbService.PlayerDatas.InsertOneAsync(playerDataIn);
    }

    // 回写一个精简版给客户端（主要是拿 DbId）
    var returnData = new PlayerData
    {
        DbId = GetConvertedId(playerDataIn.DbId),
        UserId = playerDataIn.UserId,
        Data = playerDataIn.Data
    };
    return CreatedAtAction(nameof(GetPlayerData), MemoryPackSerializer.Serialize(returnData));
}
```

`PlayerData` 长这样：

```csharp
[MemoryPackable]
public partial class PlayerData
{
    public string DbId { get; set; }     // MongoDB 的 _id
    public string UserId { get; set; }   // openid
    public byte[] Data { get; set; }     // 客户端说了算的一坨字节
}
```

好处是很直接的：**客户端改存档结构时，服务端一行都不用动**（除非改到排行榜要用的那个字段）。这一年里我改过存档的字段和关卡进程的表示方式，服务端的发布包没跟着换过。

代价也很直接：**服务端没法校验存档。** 它不知道 `Data` 里是什么，也就不知道客户端交上来的进度是不是真的。这条我在最后一节展开。

`UpdateRankData` 是唯一的例外 —— 它为了排行榜必须把存档反序列化一次，取出「已通过的最大关卡」：

```csharp
private async Task UpdateRankData(byte[] playerArchiveBytes)
{
    var playerArchive = MemoryPackSerializer.Deserialize<PlayerArchive>(playerArchiveBytes);
    if (playerArchive == null) return;
    // 存在就更新 PassLevel，不存在就插入一条
}
```

这个设计有个隐患值得写下来：**排行榜是存档的副产品，所以存档写入失败时排行榜也会跟着停在旧值。** 现在没出过问题，是因为我的存档写入几乎没有失败（主键唯一、无并发）。但如果哪天真要做「先存档、后排行榜」的严格一致，得加补偿。

### 附带做的一个小工具：客服查档

上线之后总会有玩家来说「我的进度没了」。没有后台管理系统，你连他存了什么都看不到。

所以我做了一个只读查询接口，附带一个把 MongoDB 的 24 位 `ObjectId` 压缩成短 ID 的小函数：

```csharp
private static string DecodeGameId(string id)
{
    // 24 位十六进制 → 直接返回
    if (id.Length == 24 && id.All(Uri.IsHexDigit))
        return id.ToLowerInvariant();

    // 否则按 base62 反解
    const string chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    BigInteger number = BigInteger.Zero;
    foreach (char c in id)
    {
        int idx = chars.IndexOf(c);
        if (idx < 0) throw new FormatException("非法字符: " + c);
        number = number * 62 + idx;
    }
    return number.ToString("x24");
}
```

`ObjectId` 是 24 位十六进制，人不方便念也不方便抄。base62 之后长度大约缩短三分之一，玩家报问题时念得出来。`Query?id=` 这个接口返回 JSON（而不是二进制）—— 因为它的读者是我，不是客户端。

**这是我觉得「自己写后端」最实际的收益之一**：想加一个内部工具，改十几行代码就上线了，不用等排期。

## 排行榜：Top100 加我的名次

```csharp
[HttpGet("WorldRank")]
public async Task<ActionResult<byte[]>> GetWorldRank(string userId)
{
    // 前 100 名
    var topScoreDataList = await _mongoDbService.RankData
        .Find(Builders<RankData>.Filter.Empty)
        .SortByDescending(r => r.PassLevel)
        .Limit(100)
        .ToListAsync();

    // 我自己（没有记录时给个默认值）
    var existRankData = await _mongoDbService.RankData
        .Find(r => r.UserId.Equals(userId)).FirstOrDefaultAsync();
    RankData selfRankData = existRankData ?? new RankData { UserId = userId, PassLevel = 0 };

    // 脱敏 + 去掉内部 ID
    for (int i = 0; i < topScoreDataList.Count; i++)
    {
        topScoreDataList[i].DbId = null;
        if (topScoreDataList[i].UserId != selfRankData.UserId)
            topScoreDataList[i].UserId = null;      // 别人的 openid 不下发
    }

    // 我的名次 = 比我高的人数 + 1
    var selfRanking = await _mongoDbService.RankData
        .CountDocumentsAsync(Builders<RankData>.Filter.Gt("PassLevel", selfRankData.PassLevel)) + 1;

    var rankResponseData = new RankResponseData();
    rankResponseData.SelfRanking = selfRanking;
    selfRankData.UserId = null;            // 自己的 openid 也不回传
    rankResponseData.SelfRankData = selfRankData;
    rankResponseData.RankDataList = topScoreDataList;
    return MemoryPackSerializer.Serialize(rankResponseData);
}
```

三处刻意的写法：

**别人的 `UserId` 一律置空。** openid 是用户在某个平台上的稳定身份标识，不该出现在别人的响应体里。这条现在看是基本要求，当时是写完之后才想到的。

**名次用 `CountDocumentsAsync(Gt)` 而不是全表排序。** 十万玩家的表排序一次要扫全表；数一下「比我分高的人数」能命中索引，代价和表的大小基本无关。代价是并列同分的人会拿到一样的名次 —— 排行榜里这完全可以接受。

**玩家还没有排名记录时给一个 `PassLevel = 0` 的默认对象。** 我第一版直接用了 `existRankData`，新玩家（还没上榜）一打开榜单就整个请求 500。修法就是上面那个 `?? new RankData {...}`。

## 邀请：这套代码里唯一需要「想一下」的地方

邀请奖励的逻辑是：A 邀请 B，B 进游戏后服务端给 A 加一次邀请次数，然后 B 的「邀请人」字段清空，保证同一次邀请只记一次数。

问题在于：**B 的客户端可能在不同时机、甚至重复触发这个流程。** 两个请求同时到，一次判断 `InviteId` 不为空、两次都加了次数，A 就白拿一次奖励。

解法不是加锁，是让数据库做条件更新：

```csharp
[HttpGet("SetInviteTimes")]
public async Task<IActionResult> SetInviteTimes(string userId)
{
    var selfData = await _mongoDbService.UserInfoData
        .Find(p => p.UserId == userId).FirstOrDefaultAsync();
    if (selfData == null) return BadRequest("no find inviteInfo of self!");
    if (string.IsNullOrEmpty(selfData.InviteId)) return NotFound("no exist inviter");
    if (selfData.InviteId == userId) return BadRequest("can not invite self");

    string inviterId = selfData.InviteId;

    // 原子清空 InviteId：并发下只有一次能把非空改成空
    var clearResult = await _mongoDbService.UserInfoData.UpdateOneAsync(
        p => p.UserId == userId && p.InviteId == inviterId,
        Builders<UserInfoData>.Update.Set(p => p.InviteId, string.Empty));

    if (clearResult.ModifiedCount == 0)
        return Ok();      // 已经被别的请求处理过了，直接成功返回

    // 只有真正清空成功的那一次，才给邀请人加分
    var incResult = await _mongoDbService.UserInfoData.UpdateOneAsync(
        p => p.UserId == inviterId,
        Builders<UserInfoData>.Update.Inc(p => p.InviteTimes, 1));

    if (incResult.MatchedCount == 0)
        return BadRequest("setInviteTimes no find inviteInfo of inviter!");

    return Ok();
}
```

关键在 `ModifiedCount == 0` 那一行：**它同时承担了「幂等」和「并发互斥」两个职责。** 第二个请求清空时条件已经不成立（`InviteId` 已经是空串），改 0 行，直接返回成功 —— 客户端看到的是成功，数据库里只加了一次次数。

`SetInviteId`（记录邀请人）和这里都用了「先 `Find` 再 `UpdateOne`」的两步写，`Find` 那一步纯粹是为了给出更清楚的错误信息，真正的正确性靠的是 `UpdateOne` 的条件。

**这个接口现在还是 GET，但它是写操作。** 应该改成 POST。当时图省事，后来客户端已经依赖这个形状，就懒得动了 —— 这是个应该被记下来的坏习惯。

## 配置下发：拿版本号当开关

关卡数值、活动开关，如果每次改动都要重新提审发版，小游戏就别做了 —— 微信和抖音的审核都有周期，慢的时候是按天算的。

所以配置也走服务端，用「版本号」做唯一索引：

```csharp
[ApiController]
[Route("[controller]")]
public class GameConfigController : ControllerBase
{
    // 兼容旧版客户端的路径：GET /GameConfig?version=x
    [HttpGet]
    public async Task<ActionResult<byte[]>> GetCommonConfig(string version) { ... }

    // 新路径：GET /GameConfig/GameConfig?version=x
    [HttpGet("GameConfig")]
    public async Task<ActionResult<byte[]>> GetGameConfig(string version) { ... }

    // 上传/覆盖某个版本的配置：POST /GameConfig?version=x
    [HttpPost]
    public async Task<IActionResult> UpdateGameConfig(string version) { ... }
}
```

服务端按版本号精确查，查不到返回 404；客户端拿本地版本号去问，只有版本号不一样时才重新拉一份内容。`CommonConfigData` 里除了配置本身还塞了一个 `ServerTime`，顺手把「客户端改系统时间」这个老问题一起解决了。

配置内容同样是客户端序列化出来的 `byte[]`，服务端不解析。**这意味着服务端对配置的唯一职责就是「存好、按版本号取出来」，任何和玩法相关的逻辑都不在服务端** —— 这是刻意的边界。

一个小遗憾：`/GameConfig?version=x`（兼容旧客户端）和 `/GameConfig/GameConfig?version=x` 读的是同一份数据，纯粹是为了让旧客户端不改 URL 就能继续跑。**同一个 Controller 上挂两个指向同一份数据的 GET，是我这套代码里最丑的地方**，但兼容期的代码大多长这样。

## 协议：MemoryPack 和那个 base64 的坑

这一节是全文最值得读的部分。

客户端和服务端都用 MemoryPack，请求体和响应体都是裸的二进制：

```csharp
// 客户端：POST 二进制
public IEnumerator PostRequest<T>(string url, T sendData,
    Action<T> successAction = null, Action<string> failAction = null)
{
    using var request = new UnityWebRequest(url, "POST");
    byte[] bytes = MemoryPackSerializer.Serialize(sendData);
    request.uploadHandler = new UploadHandlerRaw(bytes);
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Content-Type", "application/octet-stream");

    yield return request.SendWebRequest();

    if (request.result != UnityWebRequest.Result.Success)
    {
        Debug.LogError(request.error + ": " + request.downloadHandler.text);
        failAction?.Invoke($"{request.responseCode}:{request.error}");
        return;
    }

    // 注意这两行
    var serializedData = Convert.FromBase64String(request.downloadHandler.text.Replace("\"", ""));
    var data = MemoryPackSerializer.Deserialize<T>(serializedData);
    successAction?.Invoke(data);
}
```

`Convert.FromBase64String(...text.Replace("\"", ""))` 这行看起来很怪，但它不是随手写的 —— 它背后是我踩了一整天的坑。

**根因：Controller 的 action 返回 `byte[]` 时，ASP.NET Core 不会把字节直接写进响应体，而是交给 JSON 序列化器，而 `byte[]` 在 `System.Text.Json` 里的表示就是 base64 字符串。**

```csharp
[HttpGet("WorldRank")]
public async Task<ActionResult<byte[]>> GetWorldRank(string userId)
{
    var data = MemoryPackSerializer.Serialize(rankResponseData);
    return data;   // ← 你以为返回了一串裸字节，实际上返回了 "GkEB..." 这样的 base64 文本，外面还套了一层引号
}
```

所以客户端拿到的是 `request.downloadHandler.text` 里一个被引号包着的 base64 字符串，必须先把引号去掉、再解码、才能反序列化。`Replace("\"", "")` 处理的就是那对引号。

**正确写法是显式声明内容类型**，让它当二进制文件写出去：

```csharp
return File(data, "application/octet-stream");
```

这样客户端直接 `request.downloadHandler.data` 就是裸字节，不用 base64、也不会有引号。

这个坑有意思的地方在于：**它不会报错。** 请求成功、状态码 200、数据完整，只是体积大了三分之一、多了一次解码。我在真机上排查「排行榜加载慢」的时候才顺着体积异常找到它。

顺手记一下为什么用 MemoryPack 而不是 JSON：

- 我的存档里全是 `int`、`long`、`List<int>`，JSON 会把每个数字变成好几个字符
- MemoryPack 不走反射、不需要中间缓冲区，对 `List<int>` 这类结构特别快；`string` 仍然要分配，但少了「文本 → 解析 → 装箱」这一层
- 客户端本来就有这个库，服务端加个 NuGet 包就行

代价也很实在：**二进制协议不能靠眼睛调试。** 接口返回一个看不懂的字节流，你只能一边打日志一边反序列化。所以 Swagger 在开发期非常重要 —— 它至少让你知道接口是不是通的、状态码是什么。

## 部署：IIS、域名、HTTPS，还有两个平台的白名单

我用的是阿里云的 Windows 轻量应用服务器。选 Windows 唯一的原因是我不想在 Linux 上重新学一遍部署 —— 这个理由是充分的，不要被「服务器就该用 Linux」绑架。

部署过程没什么技术含量，但每一步都有一个会卡住你半小时的细节：

1. `dotnet publish -c Release` 出发布包，拷到服务器
2. MongoDB 装在同一台服务器上，只监听 `localhost:27017`，不对外开放
3. IIS 里建两个站点：正式绑 `8003`，测试绑 `8004`，指向同一份代码的两个目录
4. 申请证书、绑 HTTPS、强制跳转

第 3 步为什么要两个站点：客户端的 `IsOnline` 开关在「正式」和「测试」之间切，切的是 base URL。有一份随时可以乱改、不发版就能验证的测试环境，是我这一年里做对的少数决定之一。

IIS 里就是这样两个站点，同一个物理路径的两个副本，一个指 8003、一个指 8004：

![IIS 里两个站点，正式 8003 HTTPS](/images/iis-sites.png)

**最容易卡住的是域名白名单，而不是服务器。**

微信小游戏和抖音小游戏都要求把 `request` 域名填进平台后台的白名单，**而且必须是已备案的 HTTPS 域名**。不填的表现是：编辑器里一切正常，真机上一请求就失败，报的还是「网络错误」这种没有信息量的提示。

我在这上面浪费了一个下午。**顺序应该是：先把域名备案和白名单做掉，再开始写客户端网络层。** 备案要时间，代码不用等它。

## 我没做的，以及为什么

这部分我犹豫了一下要不要写。但它比前面所有内容都更有参考价值 —— 一个人自己写后端，取舍就是全部。

**没做鉴权。** 现在这套的身份就是 openid 本身：客户端登录一次拿到 openid，之后所有请求都把 openid 带上来。服务端相信这个 openid。

问题是，**openid 可以被伪造**。任何人拿到别人的 openid（比如从别人的截图、从旧的日志里），就能读写那个人的存档、就能给自己刷邀请次数。我的 response 里已经把别人的 openid 抹掉了，但「抹掉」只防君子。

正确做法是登录时下发一个 token（哪怕是 HMAC 签名的 `openid + 时间戳`），之后每个请求校验 token，服务端只信 token 里的 openid。这是我现在最想补的一块，成本大概半天。

**没做存档校验，所以没做防刷榜。** 存档是黑盒，服务端不知道里面的进度是真的还是改出来的。理论上玩家可以伪造存档把自己的关卡进度改到 9999，直接霸榜。

我评估过：这款游戏的排行榜没有实物奖励，刷榜的动机很弱；而做存档校验要么加签名（客户端能被逆向，挡不住），要么把玩法逻辑搬一部分到服务端（工作量翻几倍）。这个游戏的定位不值得。

**这条判断只对这类产品成立。** 如果排行榜牵涉到真实奖励、实物、或者现金，存档校验是必须做的，没有例外。

**没接线上日志。** 线上出问题，我是拿 Swagger 直接去查库、去调接口复现的。这不是好习惯 —— 有一次玩家说「进度回档了」，我只能看到他现在的存档，看不到他昨天写进来的那一份。

补法很简单：接一个云日志服务（阿里云 SLS 或者自己往 MongoDB 写一个 `Logs` 集合），至少把「谁在什么时候写入了什么数量的字节」记下来。半天的事，一直没做。

**没有限流、没有监控告警、没有自动备份。** 前两个是「玩家量还不够多」，第三个是**真的不该省** —— MongoDB 的单机 `mongodump` 定时任务，半小时能配好，我配得太晚了。

**没做分包。** 但这条不算「没做」：我的包体本身就在微信小游戏主包限制以内，客观上不需要分包（主包上限以官方文档为准，别照抄我这句）。分包不是能力，是包体放不下时才启用的手段 —— 这一点答辩的时候要说清楚，不然会被当成「不会」。

## 如果你也想给自己写一个：最小路径

按这个顺序，一天能跑通，一周能上线：

1. **先定四张表**：存档、排行榜、登录信息、配置。别的都等有了真实需求再加。
2. **所有业务主键上建唯一索引**，并且用 `ReplaceOptions { IsUpsert = true }` 写入，别写「先查再插」。
3. **登录只在服务端换 openid**，`AppSecret` 只存在于服务器配置里，仓库里只放 `example` 文件。
4. **接口的响应体用 `File(bytes, "application/octet-stream")`**，不要 `return bytes`。（血泪）
5. **先买域名、先备案、先在平台后台填白名单**，再去写客户端网络层。
6. **上线前写下你自己这套的身份模型**：谁知道谁的 openid？谁相信谁？哪个接口能被伪造？写不出来就别上线。
7. **给 MongoDB 配一个定时 `mongodump`**。这条比其他所有优化都重要。

## 最后

写完这套东西，最大的收获其实不在后端。

以前我在客户端里写「调一下接口拿配置」，那是我在消费一个我理解为「应该存在」的东西。现在我知道那背后是一个 Controller、一次 Mongo 查询、一个我忘写的唯一索引、一把没加的锁。

这种视角的变化是有用的 —— 它让我在写客户端的时候能提前避开一半的坑，比如「这个请求失败了要不要重试」「这个字段服务端到底会不会给 null」。

也让我对自己做的东西更诚实：这一套能撑一款小体量的消除游戏，撑不住日活十万的东西。知道边界在哪，比假装没有边界有用。

如果你也在给自己的小游戏写后端，欢迎来聊聊 —— 尤其是鉴权那一段，我到现在还没补完。
