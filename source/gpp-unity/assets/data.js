/* 数据源：模式卡片 + 分布图坐标 */

const BATCHES = {
  b1: { label: '批次 1 · 引擎主干', desc: '你天天在用却没意识到的三件事，以及让它们变慢的原因。', color: '#1e3a5f' },
  b2: { label: '批次 2 · 架构升级', desc: '开始有真实需求（配置、回放、解耦）时再读，最能立刻见效。', color: '#c14a2b' },
  b3: { label: '批次 3 · 按需查', desc: '遇到具体问题再翻。通读它们等于提前优化。', color: '#4a6b4f' }
};

/* pos: [x, y] 都在 0-100，映射到图中坐标 */
const PATTERNS = [
  {
    id: 'component', no: 1, name: '组件模式', en: 'Component', batch: 'b1', min: 25, pos: [66, 62],
    unity: ['GameObject', 'MonoBehaviour', 'RequireComponent', 'Prefab'],
    q: '什么该拆成组件、什么该拆成子对象？组件模式什么时候会拖慢你？',
    note: 'Unity 已经把它做成品了。你要学的是拆分的边界，不是实现。',
    glyph: '<rect x="8" y="18" width="26" height="28" rx="3"/><rect x="52" y="6" width="34" height="12" rx="2"/><rect x="52" y="26" width="34" height="12" rx="2"/><rect x="52" y="46" width="34" height="12" rx="2"/><path d="M34 22 L52 12M34 32 L52 32M34 42 L52 52"/>'
  },
  {
    id: 'game-loop', no: 2, name: '游戏循环', en: 'Game Loop', batch: 'b1', min: 25, pos: [18, 88],
    unity: ['Update', 'FixedUpdate', 'Time.timeScale', 'targetFrameRate'],
    q: '为什么物理和表现要用不同步长？帧率波动为什么会让物理抖？',
    note: '读它是为了搞懂时间步长，不是为了自己写循环。',
    glyph: '<circle cx="48" cy="32" r="18"/><path d="M48 20v12l8 5"/><path d="M48 10v3M76 32h3M48 54v-3M20 32h3"/>'
  },
  {
    id: 'update-method', no: 3, name: '更新方法', en: 'Update Method', batch: 'b1', min: 20, pos: [38, 84],
    unity: ['MonoBehaviour 生命周期', '协程', 'Animator'],
    q: '「一万个对象各自 Update」的开销从哪来？什么时候该集中更新？',
    note: '「对象自己知道怎么更新」很好用，代价是每帧的调度与缓存。',
    glyph: '<rect x="6" y="8" width="44" height="11" rx="2"/><rect x="6" y="26" width="44" height="11" rx="2"/><rect x="6" y="44" width="44" height="11" rx="2"/><rect x="66" y="6" width="24" height="52" rx="3" stroke-dasharray="3 3"/><path d="M52 13h9M52 31h9M52 49h9"/><path d="M58 13l4-2.5v5zM58 31l4-2.5v5zM58 49l4-2.5v5z" fill="currentColor" stroke="none"/>'
  },
  {
    id: 'observer', no: 4, name: '观察者', en: 'Observer', batch: 'b1', min: 25, pos: [80, 26],
    unity: ['event / Action', 'UnityEvent', 'SO 事件通道'],
    q: '回调地狱怎么产生的？为什么观察者会让「谁调了我」变得不可追踪？',
    note: '解耦的代价是控制流消失，所以务必留一份事件日志。',
    glyph: '<circle cx="14" cy="32" r="6"/><circle cx="82" cy="12" r="5"/><circle cx="82" cy="32" r="5"/><circle cx="82" cy="52" r="5"/><path d="M20 30c14-4 40-12 57-15"/><path d="M20 32h57"/><path d="M20 34c14 4 40 12 57 15"/>'
  },
  {
    id: 'state', no: 5, name: '状态模式', en: 'State', batch: 'b1', min: 25, pos: [60, 46],
    unity: ['手写状态类', 'StateMachineBehaviour', 'Animator'],
    q: '状态转移该由状态自己负责，还是由一个统一的转移表负责？',
    note: '把 switch 拆成类，收益在「加一个状态不改老代码」。',
    glyph: '<circle cx="22" cy="16" r="9"/><circle cx="72" cy="18" r="9"/><circle cx="46" cy="48" r="9"/><path d="M31 14h32"/><path d="M70 27c-2 9-9 14-16 17"/><path d="M38 54c-8-4-13-12-15-27"/>'
  },

  {
    id: 'type-object', no: 6, name: '类型对象', en: 'Type Object', batch: 'b2', min: 25, pos: [48, 56],
    unity: ['ScriptableObject', '[CreateAssetMenu]', 'Addressables'],
    q: '数据驱动和继承体系的边界在哪？SO 该放数据还是放行为？',
    note: 'Unity 里最值钱的一章：它决定你的配置架构。',
    glyph: '<rect x="26" y="4" width="44" height="14" rx="3"/><path d="M48 18v8" stroke-dasharray="2 3"/><rect x="10" y="26" width="76" height="8" rx="2"/><rect x="10" y="38" width="76" height="8" rx="2"/><rect x="10" y="50" width="76" height="8" rx="2"/>'
  },
  {
    id: 'command', no: 7, name: '命令模式', en: 'Command', batch: 'b2', min: 25, pos: [84, 40],
    unity: ['InputAction', '撤销栈', '录像 / 回放', 'AI 指令'],
    q: '为什么「把操作变成对象」能同时解决输入重绑、撤销、回放、AI？',
    note: '一套结构解决四件事，性价比最高的架构模式。',
    glyph: '<rect x="4" y="26" width="20" height="12" rx="2"/><rect x="36" y="18" width="26" height="28" rx="3"/><circle cx="49" cy="32" r="4"/><rect x="72" y="26" width="20" height="12" rx="2"/><path d="M24 32h9M62 32h7"/><path d="M49 46v10H16v-8" stroke-dasharray="3 3"/>'
  },
  {
    id: 'event-queue', no: 8, name: '事件队列', en: 'Event Queue', batch: 'b2', min: 25, pos: [92, 10],
    unity: ['消息队列', 'PlayerLoop 插入', '单帧延迟'],
    q: '为什么「立即回调」会产生时序 bug？队列化牺牲了什么？',
    note: '环形缓冲是它的实现，别只记名字。',
    glyph: '<rect x="4" y="24" width="18" height="16" rx="2"/><rect x="30" y="24" width="11" height="16" rx="2"/><rect x="45" y="24" width="11" height="16" rx="2"/><rect x="60" y="24" width="11" height="16" rx="2"/><rect x="78" y="24" width="14" height="16" rx="2"/><path d="M22 32h6M41 32h2M56 32h2M71 32h5"/>'
  },
  {
    id: 'service-locator', no: 9, name: '服务定位器', en: 'Service Locator', batch: 'b2', min: 20, pos: [70, 36],
    unity: ['静态注册表', 'VContainer / Zenject', 'SerializeField 注入'],
    q: '它和全局单例的区别是什么？为什么它只是「较不坏」的方案？',
    note: '能不用就不用。用了，就必须写清楚谁注册了谁。',
    glyph: '<rect x="34" y="22" width="28" height="20" rx="3"/><rect x="6" y="4" width="18" height="10" rx="2"/><rect x="72" y="4" width="18" height="10" rx="2"/><rect x="6" y="50" width="18" height="10" rx="2"/><rect x="72" y="50" width="18" height="10" rx="2"/><path d="M24 14v10l10 4M72 14v10l-10 4M24 50v-8l10-4M72 50v-8l-10-4" stroke-dasharray="3 3"/>'
  },
  {
    id: 'subclass-sandbox', no: 10, name: '子类沙箱', en: 'Subclass Sandbox', batch: 'b2', min: 20, pos: [56, 70],
    unity: ['基类 protected 辅助方法', 'PlayFx / Spawn / DealDamage'],
    q: '怎么让子类少碰全局 API？沙箱会怎么腐化？',
    note: '本质是「给子类一个受控的 API 面」。',
    glyph: '<rect x="4" y="36" width="88" height="24" rx="3"/><rect x="34" y="42" width="28" height="12" rx="2" stroke-dasharray="3 3"/><rect x="14" y="6" width="26" height="12" rx="2"/><rect x="56" y="6" width="26" height="12" rx="2"/><path d="M27 18v16M69 18v16" stroke-dasharray="3 3"/>'
  },

  {
    id: 'object-pool', no: 11, name: '对象池', en: 'Object Pool', batch: 'b3', min: 20, pos: [30, 76],
    unity: ['UnityEngine.Pool', 'ListPool / HashSetPool', '自定义池'],
    q: '池化省下来的到底是什么？不是创建时间，是 GC。',
    note: '用 Profiler 的 GC Alloc 验证，别凭感觉优化。',
    glyph: '<rect x="4" y="18" width="40" height="28" rx="3"/><circle cx="14" cy="26" r="3"/><circle cx="26" cy="26" r="3"/><circle cx="38" cy="26" r="3"/><circle cx="14" cy="38" r="3"/><circle cx="26" cy="38" r="3"/><circle cx="38" cy="38" r="3"/><circle cx="68" cy="16" r="5"/><circle cx="88" cy="20" r="5"/><path d="M44 26c8-3 12-6 18-7"/><path d="M66 40v14H46v-6" stroke-dasharray="3 3"/>'
  },
  {
    id: 'dirty-flag', no: 12, name: '脏标识', en: 'Dirty Flag', batch: 'b3', min: 20, pos: [48, 92],
    unity: ['属性缓存', 'UI 刷新节流', 'Animator 参数'],
    q: '什么时候「每帧算一遍」反而比「标记—重算」更快？',
    note: '收益来自读多写少；写多的时候它会变成负数。',
    glyph: '<path d="M18 56V8"/><path d="M18 10h22l-4 8 4 8H18z"/><path d="M64 40a12 12 0 1 1 4 9"/><path d="M64 34v6h6"/>'
  },
  {
    id: 'spatial-partition', no: 13, name: '空间分区', en: 'Spatial Partition', batch: 'b3', min: 25, pos: [34, 96],
    unity: ['Physics 宽相', 'OverlapSphere', '网格 / 四叉树'],
    q: '物理引擎已经做了宽相，你什么时候才需要自己写？',
    note: '先量：上千单位的邻近查询才值得自己上网格。',
    glyph: '<rect x="14" y="6" width="68" height="52" rx="3"/><path d="M37 6v52M59 6v52M14 23h68M14 41h68" opacity=".45"/><circle cx="27" cy="15" r="2.5" fill="currentColor" stroke="none"/><circle cx="48" cy="32" r="2.5" fill="currentColor" stroke="none"/><circle cx="70" cy="49" r="2.5" fill="currentColor" stroke="none"/><circle cx="70" cy="15" r="2.5" fill="currentColor" stroke="none"/>'
  },
  {
    id: 'data-locality', no: 14, name: '数据局部性', en: 'Data Locality', batch: 'b3', min: 30, pos: [10, 72],
    unity: ['DOTS / ECS', 'Jobs + Burst', 'NativeArray', 'SoA 布局'],
    q: '为什么「把数据排在一起」能快一个数量级？',
    note: '唯一讲「缓存未命中」的一章，也是 DOTS 的理论基础。',
    glyph: '<rect x="8" y="8" width="8" height="8"/><rect x="20" y="8" width="12" height="8"/><rect x="36" y="8" width="10" height="8"/><rect x="50" y="8" width="8" height="8"/><rect x="62" y="8" width="14" height="8"/><path d="M8 22h80" opacity=".35"/><rect x="8" y="28" width="80" height="8" rx="2" fill="currentColor" fill-opacity=".14"/><rect x="8" y="42" width="80" height="8" rx="2"/>'
  },
  {
    id: 'flyweight', no: 15, name: '享元', en: 'Flyweight', batch: 'b3', min: 20, pos: [36, 66],
    unity: ['共享 Mesh / Material', 'GPU Instancing', 'SO 共享数据'],
    q: '哪些数据是所有实例共享的，哪些是每个实例独有的？',
    note: '拆错共享 / 独有，内存翻倍或引用爆炸。',
    glyph: '<rect x="6" y="22" width="22" height="18" rx="3" fill="currentColor" fill-opacity=".14"/><rect x="58" y="4" width="20" height="12" rx="2"/><rect x="58" y="26" width="20" height="12" rx="2"/><rect x="58" y="48" width="20" height="12" rx="2"/><path d="M28 28c10-2 10-14 26-18M28 31h26M28 34c10 2 10 14 26 18"/>'
  },
  {
    id: 'double-buffer', no: 16, name: '双缓冲', en: 'Double Buffer', batch: 'b3', min: 20, pos: [60, 84],
    unity: ['输入快照', '回滚网络', '录像'],
    q: '读写同一份数据为什么会撕裂？交换指针为什么是免费的？',
    note: '渲染管线天天在用，你只在回滚 / 录制时才需要自己实现。',
    glyph: '<rect x="10" y="8" width="72" height="16" rx="2"/><rect x="10" y="40" width="72" height="16" rx="2"/><path d="M30 26l-6 8M24 30l6 0M66 38l6-8M72 34l-6 0"/><path d="M24 30h4M72 34h-4" opacity="0"/>'
  },
  {
    id: 'bytecode', no: 17, name: '字节码', en: 'Bytecode', batch: 'b3', min: 25, pos: [94, 52],
    unity: ['SO 技能配置', 'Visual Scripting', 'Lua / 热更'],
    q: '什么时候值得发明一门小语言？它的调试成本有多高？',
    note: '收益是可配置，代价是没有栈、没有断点。慎重。',
    glyph: '<rect x="6" y="12" width="50" height="40" rx="3"/><path d="M14 22h26M14 30h16M14 38h30"/><rect x="66" y="18" width="24" height="28" rx="3" stroke-dasharray="3 3"/><path d="M56 32h6"/><path d="M60 28l5 4-5 4"/>'
  },
  {
    id: 'prototype', no: 18, name: '原型', en: 'Prototype', batch: 'b3', min: 10, pos: [44, 74],
    unity: ['Instantiate(prefab)', 'Prefab Variant', 'ICloneable'],
    q: '克隆一个对象和「用工厂造一个」有什么本质区别？',
    note: 'Unity 已把它变成 Prefab，10 分钟过一遍即可。',
    glyph: '<rect x="8" y="22" width="22" height="20" rx="3"/><rect x="52" y="6" width="22" height="16" rx="3" stroke-dasharray="3 3"/><rect x="52" y="42" width="22" height="16" rx="3" stroke-dasharray="3 3"/><path d="M30 28c8-5 10-11 18-13M30 36c8 5 10 11 18 13"/>'
  },
  {
    id: 'singleton', no: 19, name: '单例', en: 'Singleton', batch: 'b3', min: 15, pos: [30, 52], warn: true,
    unity: ['static Instance', 'DontDestroyOnLoad', 'RuntimeInitializeOnLoadMethod'],
    q: '为什么全书唯一劝你别用的模式，恰好是 Unity 新手最爱用的？',
    note: '只读后半段「什么时候不要用」——那才是这章的价值。',
    glyph: '<rect x="26" y="20" width="36" height="24" rx="3"/><circle cx="44" cy="32" r="4" fill="currentColor" stroke="none"/><path d="M70 44h20"/><path d="M74 58l6-12 6 12z"/><path d="M80 50v4"/>'
  }
];
