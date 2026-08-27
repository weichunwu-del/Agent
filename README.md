# 仿真飞行模块

飞书文档 [仿真飞行需求](https://q00enigbkuh.feishu.cn/wiki/TGRswjuwnizxHNkoyJycuIRInob) 对云端环境需要登录，本仓库按已冻结的 [`docs/仿真飞行模块-PRD.md`](docs/仿真飞行模块-PRD.md) 实现可运行的仿真飞行页。

## 运行

```bash
npm install
npm test
npm run dev
```

打开仿真飞行页后：

- 空格：暂停 / 继续
- 回放条：1x / 2x / 4x、重新飞行、点击风险编号跳转
- 右侧实时分析：点击条目，第三视角与 FPV 跳到对应时刻
- 仿真结束后：有风险仅「返回手动修改」「AI 一键优化」

高保真静态稿仍在 `design/simulation-flight.html`。
