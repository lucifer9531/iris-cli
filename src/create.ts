import { homedir } from 'os';
import ora from 'ora';
import Handlebars from 'handlebars';
import chalk from 'chalk';
import { ciPrompt } from './prompt';
const { exec } = require('child_process');
const fse = require('fs-extra');
const download = require('download-git-repo');
const exists = require('fs').existsSync;
const rm = require('rimraf').sync;

const sucTextFunc = chalk.green.bold;
const failTextFunc = chalk.red;
const yellowTextFunc = chalk.yellow;

interface LocalFile {
  templateDir: string;
  ciTemplateDir: string;
}
/**
 * @description: 保证本地存储文件不存在
 * @return {*}
 */
function sureLocalFile() {
  return new Promise<LocalFile>((resolve, reject) => {
    try {
      const home = homedir();
      const templateDir = `${home}/duero-template`;
      const ciTemplateDir = `${home}/duero-template-ci`;
      // 判断本地是否存在模版内容，若存在，则清除文件
      const localDirList = [templateDir, ciTemplateDir];
      localDirList.forEach((localFile) => {
        if (exists(localFile)) {
          rm(localFile);
        }
      });
      resolve({ templateDir, ciTemplateDir });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @description: 下载远程项目模版
 * @param {string} url 远程仓库地址
 * @param {string} templateDir 本地下载目录
 * @param {string} tplTypeName 模版类型
 * @return {*}
 */
async function downloadGitLab(url: string, templateDir: string, tplTypeName = '项目模版') {
  // 删除原有目录
  await fse.remove(templateDir);
  const spinner = ora(`开始下载${sucTextFunc(tplTypeName)}...`);
  spinner.start();
  return new Promise<void>((resolve, reject) => {
    download(`direct:${url}`, templateDir, { clone: true }, function (error: any) {
      if (!error) {
        spinner.succeed(`下载${sucTextFunc(tplTypeName)}成功！`);
        resolve();
      } else {
        spinner.fail(`下载${failTextFunc(tplTypeName)}失败！`);
        reject(error);
      }
    });
  });
}

async function downloadGitLabCITemplate(ciTemplateDir: string) {
  try {
    const gitUrl = 'https://git.dustess.com/dustess-fe/docker/gitlab-ci-base.git';
    await downloadGitLab(gitUrl, ciTemplateDir, 'gitlab-ci配置模板');
  } catch (error) {
    throw error;
  }
}

/**
 * @description: 渲染模板到指定目录
 * @param {string} templateDir 本地下载目录
 * @param {string} tpl 用户所选模版名称
 * @param {string} projectName 用户输入的项目名
 * @return {*}
 */
async function generate(templateDir: string, tpl: string, projectName: string) {
  const spinner = ora(`开始${sucTextFunc('渲染项目模板')}...`);
  spinner.start();
  try {
    fse.emptyDirSync(projectName);
    fse.copySync(templateDir, projectName);
    const fileName = `${projectName}/package.json`;
    if (!fse.pathExistsSync(fileName)) {
      await fse.outputFile(fileName, '{}');
    }
    const fileObj = JSON.parse(await fse.readFile(fileName, 'utf8'));
    fileObj.name = projectName;
    if (tpl === 'vue-cli-plugin-base' && projectName.indexOf('vue-cli-plugin-') === -1) {
      fileObj.name = `vue-cli-plugin-${projectName}`;
    }
    await fse.outputFile(fileName, JSON.stringify(fileObj, undefined, '\t'));
    const replaceNameFiles = [
      {
        fileUrl: `${projectName}/README.md`,
        replaceParams: { projectName },
      },
    ];
    if (tpl === 'vue-cli-base-micro') {
      replaceNameFiles.push({
        fileUrl: `${projectName}/vue.config.js`,
        replaceParams: { projectName: getMidName(projectName) },
      });
    }
    if (tpl === 'vue-cli-base-biz-component') {
      replaceNameFiles.push(
        {
          fileUrl: `${projectName}/vant.config.js`,
          replaceParams: { projectName },
        },
        {
          fileUrl: `${projectName}/package.json`,
          replaceParams: { projectName },
        },
        {
          fileUrl: `${projectName}/src/demo-button/README.md`,
          replaceParams: { projectName },
        },
        {
          fileUrl: `${projectName}/docs/quickstart.md`,
          replaceParams: { projectName },
        }
      );
    }
    await templateItemReplace(replaceNameFiles);
    spinner.succeed(`${sucTextFunc('渲染项目模板')}成功！`);
  } catch (error) {
    spinner.fail(`${failTextFunc('渲染代码模版')}失败！`);
    throw error;
  }
}

function getMidName(projectName: string) {
  let returnStr = projectName;
  const regResult = projectName.match(/^qw-manage-(.*)-client$/);
  if (regResult && regResult.length === 2 && regResult[1]) {
    returnStr = regResult[1];
  }
  return returnStr;
}

/**
 * @description: 渲染CI模版，替换某些文件中的项目名
 * @param {string} ciTemplateDir 目标模版位置
 * @param {string} tpl 用户所选模版名称
 * @param {string} projectName 用户输入的项目名
 * @param {string} ciDirName 配置文件中对应的ci目录名
 * @param {boolean} isManualAdd 是否是通过命令手动增加ci文件
 * @return {*}
 */
async function generateCITemplate(
  ciTemplateDir: string,
  tpl: string,
  projectName: string,
  ciDirName: string,
  isManualAdd = false
) {
  const spinner = ora(`开始${sucTextFunc('渲染CI模板')}...`);
  spinner.start();
  try {
    const targetPath = isManualAdd ? '.' : projectName;
    const targetDirUrl = `${ciTemplateDir}/src/${ciDirName}`;
    await fse.copySync(targetDirUrl, targetPath);
    // 对相应文件进行字段替换
    let dockerLocationConfig = '';
    if (tpl === 'vue-cli-base') {
      dockerLocationConfig = `root /app;
            index index.html;
            try_files $uri $uri/ /index.html;`;
    } else if (tpl === 'vue-cli-base-micro') {
      dockerLocationConfig = `# 新增跨域配置
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Headers X-Requested-With;
            add_header Access-Control-Allow-Methods GET,POST,OPTIONS;
            add_header Cache-Control no-cache;
            add_header Pragma no-cache;
            add_header Expires 0;
            root /app;
            # index index.html;
            # try_files $uri /index.html;`;
    }
    const replaceNameFiles = [
      {
        fileUrl: `${targetPath}/.gitlab-ci.yml`,
        replaceParams: { projectName },
      },
      {
        fileUrl: `${targetPath}/Makefile`,
        replaceParams: { projectName },
      },
      {
        fileUrl: `${targetPath}/Dockerfile`,
        replaceParams: { projectName: getMidName(projectName) },
      },
      {
        fileUrl: `${targetPath}/docker/nginx.test.conf`,
        replaceParams: { dockerLocationConfig },
      },
    ];
    await templateItemReplace(replaceNameFiles);
    spinner.succeed(`${sucTextFunc('渲染CI模板')}成功！`);
  } catch (error) {
    spinner.fail(`${failTextFunc('渲染CI模版')}失败！`);
    throw error;
  }
}

interface filesItemObj {
  fileUrl: string;
  replaceParams: Object;
}
/**
 * @description: 模版字符串替换
 * @param {Array} files 需要替换的内容
 * @return {*} null
 */
async function templateItemReplace(files: Array<filesItemObj>) {
  try {
    files.forEach(async (item) => {
      const fileContent = await fse.readFile(item.fileUrl, 'utf8');
      // 实例化文件内容
      const template = Handlebars.compile(fileContent);
      // 替换文件内容中的projectName字段
      const replacedFileContent = template(item.replaceParams);
      await fse.outputFile(item.fileUrl, replacedFileContent);
    });
  } catch (error) {
    throw error;
  }
}

/**
 * @description: git初始化
 * @param {string} projectName 项目名称
 * @return {*}
 */
async function startGitInit(projectName: string) {
  return new Promise<void>((resolve, reject) => {
    const gitInitSpinner = ora(
      `cd ${sucTextFunc(projectName)} 目录, 执行 ${sucTextFunc('git init')}...`
    );
    gitInitSpinner.start();
    const gitInit = exec(
      `cd ./${projectName} && git init && git add . && git commit -m "chore: init" && git branch dev && git branch dev2 && git branch dev3 && git branch dev4 && git branch dev5 && git branch master2 && git branch master3 && git branch master4 && git branch release && git branch tencent`
    );
    gitInit.on('close', (code: any) => {
      if (code === 0) {
        gitInitSpinner.color = 'green';
        gitInitSpinner.succeed(`${sucTextFunc('git init')}成功！`);
        resolve();
      } else {
        gitInitSpinner.color = 'red';
        gitInitSpinner.fail(`${failTextFunc('git init')}失败`);
        reject('git init 失败');
      }
    });
  });
}

/**
 * @description: yarn 安装依赖
 * @param {string} projectName 项目名称
 * @return {*}
 */
async function startYarn(projectName: string) {
  return new Promise<void>((resolve, reject) => {
    // 安装依赖
    const installSpinner = ora(`${sucTextFunc('yarn')} 安装项目依赖, 请稍后...`);
    installSpinner.start();
    exec(`cd ./${projectName} && yarn`, (error: any) => {
      if (error) {
        installSpinner.color = 'red';
        installSpinner.fail(`${failTextFunc('项目依赖')}安装失败，请自行重新安装！`);
        reject(error);
      } else {
        installSpinner.color = 'green';
        installSpinner.succeed(`${sucTextFunc('项目依赖')}安装成功！`);
        resolve();
      }
    });
  });
}

/**
 * @description: 创建项目
 * @param {string} tpl 选择的模版名称
 * @param {string} name 项目名称
 * @param {object} tplObj 模版对象列表
 * @param {boolean} needYarn 是否需要yarn安装依赖
 * @return {*}
 */
export async function create(tpl: string, name: string, tplObj: object, needYarn: boolean) {
  try {
    // 获取本地存储模版路径并保证该路径无相关文件
    const { templateDir, ciTemplateDir } = await sureLocalFile();
    // 根据模板选择渲染模板
    const url: string = tplObj[tpl].url;
    const ciDirName: string = tplObj[tpl]?.ci?.dirName || '';
    const noGitInitAndYarn: boolean = tplObj[tpl].noGitInitAndYarn;
    // 下载模板代码
    await downloadGitLab(url, templateDir);
    // 渲染模板代码
    await generate(templateDir, tpl, name);
    // 如果ci模版中存在DirName则渲染相应的ci模版
    if (ciDirName) {
      const needInquirerCI: boolean = tplObj[tpl].needInquirerCI;
      let isContinue = true;
      if (needInquirerCI) {
        isContinue = (await ciPrompt()).installCI;
      }
      if (isContinue) {
        // 下载 gitlab-ci 配置文件
        await downloadGitLabCITemplate(ciTemplateDir);
        // 渲染 gitlab-ci 配置文件
        await generateCITemplate(ciTemplateDir, tpl, name, ciDirName);
      }
    }
    if (!noGitInitAndYarn) {
      // GitLab 仓库初始化、依赖安装
      await startGitInit(name);
      if (needYarn) {
        await startYarn(name);
      }
    }
    // traefik 网关新增
    // 微应用列表配置新增
    console.log(`Successfully created project ${yellowTextFunc(name)}`);
  } catch (error) {
    console.log(error);
  }
}

// 手动添加ci相关文件
export async function addCiFunc(tpl: string, ciDirName: string) {
  const projectName = JSON.parse(await fse.readFile('package.json', 'utf8')).name;
  const { ciTemplateDir } = await sureLocalFile();
  // 下载 gitlab-ci 配置文件
  await downloadGitLabCITemplate(ciTemplateDir);
  // 渲染 gitlab-ci 配置文件
  await generateCITemplate(ciTemplateDir, tpl, projectName, ciDirName, true);
}
