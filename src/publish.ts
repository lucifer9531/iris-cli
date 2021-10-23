import chalk from 'chalk';
import axios from 'axios';

const { execSync } = require('child_process');
const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');

const sucTextFunc = chalk.green.bold;
const yellowTextFunc = chalk.yellow;
const failTextFunc = chalk.red;
let parentFolderPath = ''; //包文件父级目录名
let filePath = path.join('.', 'package.json'); //package.json文件地址
let pkgName = ''; //package.json中的包名
let versionIsSame = true;
let branchName = 'release';
let tagName = '';
let robotNoticeContent = '';
let npmrcExists = false;

/**
 * @description: 确保对应路径的package.json的version与tag中的version一致
 * @param {*} version 版本号
 * @return {*}
 */
async function changePackageVersion(version: string) {
  // 获取相关信息并推送
  const gitName = execSync(`git show ${tagName} -s --format=%cn`).toString().trim();
  const arr = gitName.split('\n')[1].split('<');
  const taggerName = arr[0].split('Tagger: ')[1].trim();
  // 机器人消息文本
  const tagMsg = gitName.split('>')[1].replace(taggerName, '');
  const taggerEmail = arr[1].split('>')[0].trim();
  robotNoticeContent = `${pkgName}项目 ${version}版本 已由 ${taggerName} 发布。发布内容如下：${tagMsg} \n\n项目地址：https://npm.dustess.com/-/web/detail/${pkgName}`;

  // 完成git前置配置
  // 切换分支
  await execSync(
    `git fetch origin && (git checkout ${branchName} || git checkout -b ${branchName} origin/${branchName}) && git checkout -- . && git pull`
  );
  await execSync(
    `git config --global user.email ${taggerEmail} && git config --global user.name ${taggerName}`
  );
  console.log('设置姓名邮箱成功');

  const fileContentObj = JSON.parse(await fse.readFile(filePath, 'utf8'));
  if (fileContentObj.version !== version) {
    // 更改pkg中的version
    versionIsSame = false;
    fileContentObj.version = version;
    await fse.outputFile(filePath, JSON.stringify(fileContentObj, null, 2), {
      ending: 'utf-8',
    });

    await execSync(`git add ${filePath} && git commit -m "chore: 修改版本号"`);
    console.log('提交信息设置成功');
  }
}

/**
 * @description: 找到name为pkgName的package.json文件的文件目录
 * @param {string} fileName 要查找的文件名
 * @param {*} dir 要查找的目录，默认当前目录
 * @return {*}
 */
async function searchFileFunc(fileName: string, version: string, dir = '.') {
  if (pkgName) {
    const fileList = fs.readdirSync(dir);
    for (let index = 0; index < fileList.length; index++) {
      const item = fileList[index];
      const fullPath = path.join(dir, item);
      const stats = await fs.statSync(fullPath);
      if (stats.isDirectory() && item !== 'node_modules') {
        // 逐级查找package.json文件
        await searchFileFunc(fileName, version, fullPath);
      } else if (item === fileName) {
        const { name: findItemPkgName } = JSON.parse(await fse.readFile(fullPath, 'utf8'));
        if (findItemPkgName === pkgName) {
          filePath = fullPath;
          parentFolderPath = dir;
        }
      }
    }
  }
}

/**
 * @description: 执行推送相关动作:
 * 1.确认是否为多子工具包仓库，如果是则查找父级文件名
 * 2.更改包名为pkgName的package.json文件中的version
 * 3. 确保version一致，不一致则推送至远程仓库
 * @param {string} version：tag中的版本号
 * @param {string} accessToken：git推送相关token
 * @param {string} npmToken：npm推送拉取仓库所需token
 * @param {string} robotUrl：企微群聊机器人地址
 * @return {*}
 */
const startPublish = async (
  version: string,
  accessToken: string,
  npmToken: string,
  robotUrl: string
) => {
  await searchFileFunc('package.json', version);
  await changePackageVersion(version);
  await addNpmToken(npmToken);
  await goPublish();
  robotUrl && (await robotNotice(robotUrl));
  if (!versionIsSame || robotUrl) {
    await pushCode(accessToken);
  }
  if (!versionIsSame) {
    console.log(
      yellowTextFunc(
        `发现package.json中版本号与本次发布不一致，已更改版本号并且推送至 ${branchName} 分支`
      )
    );
  }
};

// 增加.npmrc文件中的私有库token
async function addNpmToken(npmToken: string) {
  const filePath = path.join(parentFolderPath, '.npmrc');
  npmrcExists = await fse.pathExistsSync(filePath);
  await fse.ensureFileSync(filePath);
  let fileContent = await fse.readFile(filePath, 'utf8');
  fileContent += `
//npm.dustess.com/:_authToken="${npmToken}"
  `;
  console.log({ filePath });

  await fse.outputFile(filePath, fileContent, {
    ending: 'utf-8',
  });
}

async function goPublish() {
  const filePath = path.join(parentFolderPath, '.npmrc');
  if (!pkgName.includes('vue-cli-plugin-')) {
    // 除了cli插件以外都需要构建
    try {
      await execSync(`cd ${parentFolderPath} && yarn && yarn build`);
      console.log('yarn 安装以及 build 成功');
    } catch (error) {
      console.log('无build脚本');
    }
  }
  await execSync(`cd ${parentFolderPath} && npm publish --registry https://npm.dustess.com`);
  // npm推送成功之后将.npmrc文件的更改还原
  let returnFile = '';
  npmrcExists ? (returnFile = `git checkout -- ${filePath}`) : (returnFile = `rm ${filePath}`);
  await execSync(returnFile);
}

async function robotNotice(robotUrl: string) {
  await axios.post(robotUrl, {
    msgtype: 'text',
    text: {
      content: robotNoticeContent,
      mentioned_list: ['@all'],
    },
  });
  try {
    await execSync(`yarn changelog`);
    await execSync(`git add . && git commit -m "docs: 更新日志"`);
  } catch (error) {
    console.log('没有changelog命令');
  }
}

async function pushCode(accessToken: string) {
  const remoteMsg = await execSync('git remote -v').toString().trim();
  const remoteUrl = remoteMsg
    .split('\t')
    .find((item: string) => item.includes('dustess-fe'))
    .split(' ')[0];
  let regRule = /https:\/\//;
  if (remoteUrl.includes('@')) {
    regRule = /https:\/\/.*@/;
  }
  const pushUrl = remoteUrl.replace(regRule, `https://${accessToken}@`);
  console.log({
    remoteMsg,
    remoteUrl,
    pushUrl,
  });

  const bashStr = `git push ${pushUrl} HEAD:${branchName}`;
  console.log({ bashStr });
  await execSync(bashStr);
  console.log('推送代码成功');
}

const publishCommand = async (accessToken: string, npmToken: string, robotUrl = '') => {
  try {
    //更新本地的tag数据
    execSync('git fetch --tags --force');
    // 获取最新tag信息
    tagName = process.env.CI_COMMIT_REF_NAME || '';

    const tagArr = tagName.split('-');
    branchName = tagArr[0];
    const version = tagArr[tagArr.length - 1].replace(/v|V/, '');
    // master-xxx-v0.0.1
    if (tagArr.length > 2) {
      // 多工具仓库
      pkgName = tagArr.slice(1, tagArr.length - 1).join('-');
    }
    console.log({ tagName, version, pkgName, branchName });
    await startPublish(version, accessToken, npmToken, robotUrl);
    console.log(sucTextFunc('发布成功'));
  } catch (error) {
    console.log(failTextFunc('发布失败，请查看错误信息并保证打标签已遵循相关规范'));
    console.log({ error });
    process.exit(1);
  }
};

export { publishCommand };
