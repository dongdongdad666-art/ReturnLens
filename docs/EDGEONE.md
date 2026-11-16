# EdgeOne Pages 部署

保留 ReturnLens 现有线上版本。数据导入、脱敏、模拟预算和整改流程均在浏览器内执行，无真实AI调用或后端数据库。

| 项目 | 填写 |
| --- | --- |
| GitHub仓库 | dongdongdad666-art/ReturnLens |
| 生产分支 | codex/edgeone-migration |
| 框架 | Other / 其他 |
| 根目录 | 留空 |
| 安装命令 | npm ci --no-audit --no-fund |
| 构建命令 | npm run build:edgeone |
| 输出目录 | dist |
| Node.js | 22.21.1 |
| 加速区域 | 全球（不含中国大陆） |
| 环境变量 | 不需要 |

CSV演示数据和图标已包含在public中，无需COS。不要执行生成脚本覆盖冻结的演示数据；构建直接使用已核对的文件。保留原vercel.json供历史验证，Pages使用edgeone.json。

预览部署后：
1. 打开 /import，点击「使用内置模拟品牌」→「开始模拟分析」→「开始批次模拟」，按界面处理批次。费用与追加预算均为本地模拟。
2. 检查 / 的经营总览、/issues 的SKU筛选和问题详情、/actions 整改看板、/experiments 实验复盘。
3. 直接打开 /issues/I-SKU-123 并刷新，确认SPA路由正常；问题数据来自当前浏览器，先完成演示导入。
4. 「数据与设置」可清除本地演示数据。无需上传真实订单或客户信息。
5. 正常后可绑定 returnlens.szydym.com，按Pages提供的CNAME和HTTPS步骤设置。域名验收后再修改IJane作品集入口。

原项目以桌面/平板为目标，宽度小于768px显示「请使用平板或桌面浏览器查看」提示；迁移保留这个行为。

开发验证：npm test -- --maxWorkers=2；npm run test:deployment；npm run lint；npm run build:edgeone。

迁移基线采用Git ffca6c0（后续宣传片功能之前），重新构建的全部JS/CSS与现网发布包一致。原线上HTML存在换行/空行、CSV存在CRLF差异，文本内容一致。未添加后来的promo页面。
