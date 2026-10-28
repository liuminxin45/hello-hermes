# Hermes 工厂：空间交互原型

这是最初的 0.1 原型档案。正式网站已采用 `docs/public/factory/` 的欢迎礼盒实习馆，参见 `editorial/factory-blueprint.md`；本目录不作为主站入口。

以 Three.js 搭建的教学展馆。浏览器中看一次简报任务如何在职责之间流转，无需模型 API 或 Hermes 安装。

```powershell
node prototypes/hermes-factory/serve.mjs
```

打开 <http://127.0.0.1:4397/>。服务仅绑定本机，只提供此目录文件。可通过环境变量 `FACTORY_PORT` 更换端口。

- 拖动旋转，滚轮缩放；手机单指旋转、双指缩放和平移。
- 点击建筑或下方站点走近观察。「带我参观」逐站移动。
- 「进入车间」切换低视角，用 W/A/S/D 或画面方向按钮移动，拖动环顾；Esc 或「全景」退出。
- 开始、暂停、逐步和进度定位共用同一条回放状态。改变故障条件会重置记录。
- 支持深浅主题、键盘站点导航、减少动态效果偏好。没有 WebGL 时仍可读取任务状态与文字记录。

这是固定教学脚本，不连接真实模型，不执行真实工具。动画不表示实际耗时或隐藏思考。A/B/C 材料来自项目虚构案例，已存简报做法与工具读取为新增教学设定。只展示草稿交付，不发送消息。

独立验证：

```powershell
node --test prototypes/hermes-factory/model.test.mjs
```

设计提案见 `editorial/cookbook-design.md`。本原型尚未加入公开站点导航，没有改动当前十八章。

## 第三方资源

`vendor/` 包含 npm 官方包 `three@0.180.0` 的 `three.module.min.js`、`three.core.min.js`、`OrbitControls.js`，保留 `LICENSE.three`。下载包的 SHA512 integrity：

`sha512-o+qycAMZrh+TsE01GqWUxUIKR1AL0S8pq7zDkYOQw8GqfX8b8VoCKYUoHbhiX5j+7hr8XsuHDVU6+gkQJQKg9w==`

仅本地静态依赖，无 CDN、遥测或模型密钥。展馆代码遵循本仓库 MIT 许可；原创教学文案依项目 CC BY-SA 4.0。
