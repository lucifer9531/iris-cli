# iris-cli
创建 vue 项目的脚手架工具。

## 目录说明
```plain
|—— bin 
|   └── index.js                              // 脚手架入口文件
|—— src
|   |—— cli.ts                                // 命令行参数解析文件
|   |—— create.ts                             // 模板创建文件
|   |—— index.ts                              // 命令行入口文件
|   └── prompt.js                             // 获取用户输入文件
|—— test 
|   └── blah.test.ts                          // 测试示例文件
|—— .editorconfig                             // 在不同的编辑器和IDE之间定义和维护一致的编码样式
|—— .gitignore                                // git提交需要忽略的文件或文件目录；
|—— LICENSE                                   // 证书
|—— package.json                              // 项目配置内容
|—— README.md                                 // 项目描述
|—— tsconfig.json                             // TypeScript相关配置；
└── yarn.lock                                 // 锁定安装包
```

## 技术选型

1. [TSDX](https://github.com/formium/tsdx)-开发 TypeScript 库的零配置命令行工具
2. [inquirer](https://github.com/SBoudrias/Inquirer.js)-处理复杂的用户输入，完成命令行输入交互
3. [commander](https://github.com/tj/commander.js)-进行复杂的命令行参数解析
4. [chalk](https://github.com/chalk/chalk)-终端输出彩色文案信息
5. [handlebars](https://www.npmjs.com/package/handlebars)-模版字符串处理
6. [ora](https://github.com/sindresorhus/ora)-命令行出现好看的 Spinners
7. [download-git-repo](https://www.npmjs.com/package/download-git-repo)-下载 Git 远程仓库代码

## 实现方案
通过 package.json 文件中的 bin 字段向操作系统中注入全局命令，之后即可运行 iris 命令。用户通过 iris create <项目名> 创建项目名，选择需要拉取的项目模版，根据用户的选择下载相应的项目模版并复制到本地，最后再通过执行相关命令行命令来完成 git 初始化，分支创建以及依赖包的安装。

## 本地如何开发调试
1. 依赖安装
  ``` plan
  yarn
  ```

2. 更改项目代码后重新打包

手动打包：
  ``` plan
  yarn build
  ```

自动打包：
  ``` plan
  yarn start
  ```

3. 脚手架命令链接到本地
  ``` plan
  # 在脚手架根目录下执行
  npm link
  ```

4. 取消脚手架命令链接到本地
  ``` plan
  ```

5. 发布到 npm 库
