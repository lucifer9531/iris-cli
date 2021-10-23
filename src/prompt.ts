import Inquirer from 'inquirer';

export async function prompt(tplObj: object) {
  const defaultTpl = 'vue-cli-base';
  const choices = [];
  for (const key in tplObj) {
    // @ts-ignore
    choices.push(`${key}: ${tplObj[key].remark}`);
  }
  const questions = [
    {
      type: 'list',
      name: 'tpl',
      message: '请选择一种模板类型？',
      choices,
      default: defaultTpl,
    },
  ];
  const answers = await Inquirer.prompt(questions);
  return {
    tpl: answers.tpl || defaultTpl,
  };
}

export async function handleExistPrompt(prjName: string) {
  const defaultStatus = false;
  const questions = [
    {
      type: 'confirm',
      name: 'isContinue',
      message: `文件 ${prjName} 已存在，是否继续？（继续将覆盖原文件内容）`,
      default: defaultStatus,
    },
  ];
  const answers = await Inquirer.prompt(questions);
  return {
    isContinue: answers.isContinue || defaultStatus,
  };
}

export async function ciPrompt() {
  const questions = [
    {
      type: 'confirm',
      name: 'installCI',
      message: '是否需要安装ci相关文件',
      default: true,
    },
  ];
  const answers = await Inquirer.prompt(questions);
  return {
    installCI: answers.installCI,
  };
}

export async function getCIPrompt(tplObj: object) {
  const newMsgArray: Array<String | any> = [];
  const ciList: any[] = [];
  for (const key in tplObj) {
    if (tplObj[key]?.ci) {
      newMsgArray.push({
        tplName: `${key}: ${tplObj[key].remark}`,
        dirName: tplObj[key].ci.dirName,
        ciDes: tplObj[key].ci.ciDes,
      });
      if (!ciList.includes(tplObj[key].ci.ciDes)) {
        ciList.push(tplObj[key].ci.ciDes);
      }
    }
  }
  const ciDefault = ciList[0];
  const questions = [
    {
      type: 'list',
      name: 'ciAnswer',
      message: '请选择一种ci模版：',
      choices: ciList,
      default: ciDefault,
    },
  ];
  const ciResult = (await Inquirer.prompt(questions)).ciAnswer || ciDefault;
  // @ts-ignore
  const findList = newMsgArray.filter((item) => item.ciDes === ciResult);
  // @ts-ignore
  const tplNameList = findList.map((item) => item.tplName);
  let lastResult: any = null;
  if (tplNameList.length > 1) {
    const tplDefault = tplNameList[0];
    const questions2 = [
      {
        type: 'list',
        name: 'tplAnswer',
        message: '请选择项目所属模版？（项目类型属于那种模版）',
        choices: tplNameList,
        default: tplDefault,
      },
    ];
    const tplResult: string = (await Inquirer.prompt(questions2)).tplAnswer || tplDefault;
    // @ts-ignore
    lastResult = findList.find((item) => item.tplName === tplResult);
  } else {
    // @ts-ignore
    lastResult = findList.find((item) => item.tplName === tplNameList[0]);
  }
  const { tplName, dirName: ciDirName } = lastResult;
  return {
    tpl: tplName.split(':')[0],
    ciDirName,
  };
}
