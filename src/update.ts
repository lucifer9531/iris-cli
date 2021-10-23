import chalk from 'chalk';

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const sucTextFunc = chalk.green.bold;
const yellowTextFunc = chalk.yellow;
const redTextFunc = chalk.red;
const matchArr: any[] = [];
const manifestYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: "!PROJECT_NAME"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: "!PROJECT_NAME"
      environment: "!IMAGE_TAG"
  template:
    metadata:
      labels:
        app: "!PROJECT_NAME"
        environment: "!IMAGE_TAG"
    spec:
      imagePullSecrets:
      - name: dustess-registry-ci-key
      containers:
      - image: registry-in.dustess.com:9000/!DOCKER_IMAGE_NAME:!IMAGE_TAG
        imagePullPolicy: Always
        name: "!PROJECT_NAME"
        livenessProbe:
          httpGet:
            path: /healthy
            port: 80
            scheme: HTTP
        readinessProbe:
          httpGet:
            path: /healthy
            port: 80
            scheme: HTTP
        ports:
          - containerPort: 80
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh","-c","sleep 3; nginx -s quit; while killall -0 nginx; do sleep 1; done"]
      terminationGracePeriodSeconds: 31
      nodeSelector:
        'mk.dustess.com/biz': "true"
---
apiVersion: v1
kind: Service
metadata:
  name: "!PROJECT_NAME"
  labels:
    svc: "!PROJECT_NAME"
spec:
  selector:
    app: "!PROJECT_NAME"
    environment: "!IMAGE_TAG"
  ports:
  - port: 80
    protocol: TCP
    name: web
`;

/**
 * @description: 查找当前目录下所有匹配的fileName并返回他们的路径
 * @param {string} fileName 要查找的文件名
 * @param {*} dir 要查找的目录，默认当前目录
 * @return {*}
 */
async function searchFiles(fileName: string, dir = '.') {
  const fileList = fs.readdirSync(dir);
  fileList.forEach((item: any) => {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory() && item !== 'node_modules') {
      searchFiles(fileName, fullPath);
    } else if (item === fileName) {
      matchArr.push(fullPath);
    }
  });
}

/**
 * @description: 更新文件内容函数
 * @param {string} fileName 文件名
 * @param {any} options 参数
 * @return {*}
 */
export async function updateCommand(fileName: string, options: any) {
  try {
    const canUpdateFiles = ['manifest.yaml'];
    if (!canUpdateFiles.includes(fileName)) {
      return console.log(yellowTextFunc(`目前仅支持更新 ${canUpdateFiles.join('、')}`));
    }

    const { deep = false } = options;
    if (deep) {
      // 批量更新当前目录以及子目录下所有匹配的文件名
      await searchFiles(fileName);
      if (!matchArr.length) {
        return console.log(yellowTextFunc(`当前目录及其子目录下不存在 ${fileName} 文件`));
      }
    } else {
      // 仅更新当前目录下匹配的文件名
      if (!fse.pathExistsSync(fileName)) {
        return console.log(yellowTextFunc(`当前目录下不存在 ${fileName} 文件`));
      }
      matchArr.push(path.join('.', fileName));
    }
    matchArr.forEach((item) => {
      fse.outputFile(item, manifestYaml);
    });
    console.log('匹配文件：', matchArr);
    console.log(sucTextFunc('更新成功'));
  } catch (error) {
    console.log(redTextFunc('更新文件内容出错'), error);
  }
}
