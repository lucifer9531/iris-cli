import { create, addCiFunc } from './create';
import { prompt, handleExistPrompt, getCIPrompt } from './prompt';
import { updateCommand } from './update';
import { publishCommand } from './publish';
import axios from 'axios';
import commander from 'commander';
import chalk from 'chalk';

const { spawn } = require('child_process');
const yellowTextFunc = chalk.yellow;
const redTextFunc = chalk.red;
const exists = require('fs').existsSync;
const { version: pkgVersion = '0.0.1' } = require('../package.json');
const program = commander.program;

/**
 * @description: 判断用户输入的项目名是否已存在
 * @param {string} prjName：用户输入项目名
 * @return {boolean} 是否继续
 */
async function projectIsExists(prjName: string) {
  if (exists(prjName)) {
    const { isContinue } = await handleExistPrompt(prjName);
    if (isContinue) {
      return true;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * @description: 开始创建项目
 * @param {string} prjName：用户输入项目名
 * @param {string} template 用户输入的项目模版名称
 * @param {boolean} needYarn 是否需要yarn安装依赖
 * @return {*}
 */
async function startCreate(prjName: string, template: string, needYarn: boolean) {
  // 获取仓库模版内容
  const { data: tplObj = {} } = await axios.get(
    'https://cf-config-test.oss-cn-hangzhou.aliyuncs.com/scrm/dev/cli-template-config/index.json'
  );
  const templateName = template || (await prompt(tplObj)).tpl.split(':')[0];
  if (tplObj[templateName]) {
    if (templateName === 'vue-cli-base-uni') {
      // 对uni小程序创建单独执行命令
      spawn(
        `vue create -p direct:https://git.dustess.com/dustess-fe/template/vue-cli-base-uni.git --clone ${prjName}`,
        [],
        { stdio: 'inherit', shell: true }
      );
    } else {
      // 正常流程创建项目
      create(templateName, prjName, tplObj, needYarn);
    }
  } else {
    console.log(redTextFunc('请保证模版名称正确'));
  }
}

/**
 * @description: create命令对应的处理函数
 * @param {string} prjName 项目名称
 * @param {object} options 选项
 * @param {any} command 命令对象本身
 * @return {*}
 */
async function createCommand(prjName: string, options: any) {
  try {
    // 判断创建的项目名是否已存在
    const isContinue = await projectIsExists(prjName);
    if (isContinue) {
      const { template = '', yarn: needYarn } = options;
      await startCreate(prjName, template, needYarn);
    }
  } catch (error) {
    console.log(
      yellowTextFunc(
        '请确保拥有对应模版仓库（dustess-fe/docker以及dustess-fe/template）的权限，若无，请联系上级添加权限。'
      )
    );
    console.log('创建模版出错，error：', error);
  }
}

async function addCiCommand() {
  // 获取仓库模版内容
  const { data: tplObj = {} } = await axios.get(
    'https://cf-config-test.oss-cn-hangzhou.aliyuncs.com/scrm/dev/cli-template-config/index.json'
  );
  const { tpl, ciDirName } = await getCIPrompt(tplObj);
  addCiFunc(tpl, ciDirName);
}

export default async function cli() {
  program
    .name('duero')
    .version(pkgVersion, '-v --version', 'output the current version')
    .command('create <prjName>')
    .option('-t, --template <name>', '手动输入模版名称')
    .option('-ny, --no-yarn', '是否需要执行 yarn 安装仓库依赖，默认需要')
    .description('创建 Vue 项目，prjName 为项目名称（不能带scope）')
    .action(createCommand);

  program.command('addCI').description('手动添加CI相关文件').action(addCiCommand);

  program
    .command('update <fileName>')
    .option('-d, --deep', '是否深度遍历其子目录，默认否')
    .description('更新与 fileName 匹配的文件名的文件内容， fileName 为需要匹配的文件名')
    .action(updateCommand);

  program
    .command('publish <accessToken> <npmToken> [robotUrl]')
    .description('根据 tag 信息发布对应工具包到 npm 私有库。（需安装 npm 以及 git ）')
    .action(publishCommand);

  await program.parseAsync(process.argv);
}
