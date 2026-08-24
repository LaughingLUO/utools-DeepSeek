# DeepSeek 插件最近改动说明

日期：2026-08-24

## 本次改动目标

这批改动主要围绕 uTools DeepSeek 插件的多账号托管能力展开，重点是把原先偏单账号、偏直接打开网页的流程，调整为更适合后续扩展的账号管理和独立窗口架构。

## 已完成内容

1. 新增了 DeepSeek 账号管理页。
2. 增加了账号绑定、默认账号、重新绑定、注销、删除等交互入口。
3. 把 DeepSeek 相关逻辑拆分到了 `components`、`composables`、`services` 目录，便于后续继续维护。
4. 增加了本地 `browser-shell.html` 壳页，用于承接 `createBrowserWindow` 的独立窗口方案。
5. 新增了 `deepseek-webview-preload.js`，用于在 DeepSeek 页面上下文里采集 `localStorage` 中的 `userToken` 等会话信息。
6. 新增了账号会话存储、绑定状态存储、默认账号管理等数据层逻辑。
7. 修复了一个会导致主页面空白的问题：
   `browserWindows.js` 之前在模块顶层直接访问 Electron 运行时，现已改成按需获取，避免主界面初始化时直接报错。

## 当前窗口链路状态

目前代码已经切到了“主页面管理账号 + 独立窗口承载 DeepSeek”的方向，但 `createBrowserWindow` 打开 DeepSeek 账号窗口的链路仍在调试中，尤其是下面几个点还需要继续验证：

1. 本地壳页加载后，`webview` 是否稳定完成初始化。
2. 绑定账号时，是否总能打开干净的 `https://chat.deepseek.com/sign_in` 页面。
3. 登录完成后，是否能稳定抓取并存回 `userToken` 与 cookies。
4. 打开已绑定账号时，是否能先清理旧会话，再准确恢复当前账号身份。

## 当前代码重点文件

1. `src/DeepSeek/index.vue`
   新的 DeepSeek 主设置页。
2. `src/DeepSeek/composables/useDeepSeekAccounts.js`
   账号绑定、默认账号、打开窗口等交互编排。
3. `src/DeepSeek/services/accountStore.js`
   账号、会话、绑定状态的本地存储封装。
4. `src/DeepSeek/services/browserWindows.js`
   `createBrowserWindow` / 分区 / 会话恢复相关逻辑。
5. `public/browser-shell.html`
   独立窗口本地壳页。
6. `public/preload/deepseek-webview-preload.js`
   DeepSeek 页面上下文的会话采集脚本。

## 说明

本说明文档记录的是截至 2026-08-24 的最近一轮改动，用于后续继续排查账号窗口、绑定流程和 token 回写链路。
