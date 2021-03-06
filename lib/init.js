'use strict';

module.exports = function () {
  'use strict';
  //默认配置

  var request = require('./net');
  var configUrl = 'https://api.github.com/repos/lovetingyuan/fq/contents/src/defaultConfig.json';
  var tagConfig = request.githubGet('https://api.github.com/repos/lovetingyuan/fq/tags');
  request.grabUrl(tagConfig).then(function (data) {
    var tagInfo = JSON.parse(data.response);
    var latestVersion = tagInfo[0].name.substr(1);
    var currentVersion = require('../package.json').version;
    if (latestVersion !== currentVersion) {
      console.log('freess@' + currentVersion + ' is deprecated, latest version is ' + latestVersion + ', please update');
    }
    return request.grabUrl(request.githubGet(configUrl));
  }).then(function (data) {
    var defaultConfig = JSON.parse(data.response);

    var account = require('./account');
    var constValue = require('./enum');
    var client = require('./client');
    var file = require('./file');
    if (!file.has(constValue.dirName, 'dir')) {
      require('fs').mkdirSync(constValue.dirName); // 建立shadowsocks目录
      file.Json(constValue.configPath).write(defaultConfig);
    }

    var ssClientProcessHandler = void 0;
    var lastestHash = '';
    var timer = void 0;

    function onCloseClient() {
      console.log('ss client has closed.');
      timer && clearInterval(timer);
    }

    console.log("starting fq...");
    console.log('getting ss account...');
    account.setSSAccount(defaultConfig.accountUrl).then(function () {
      console.log('get ss account successfully...');
      if (!file.has(constValue.clientPath, 'file')) {
        console.log('no ss client, downloading...');
        return client.downloadClient();
      }
    }).then(function () {
      return Promise.all([client.getLastClientInfo(), client.getClientSha1()]);
    }).then(function (values) {
      lastestHash = values[0].sha1;
      if (values[0].sha1 !== values[1]) {
        console.log('ss client is out of date, updating...');
        return client.downloadClient();
      } else {
        ssClientProcessHandler = client.startClient(onCloseClient);
      }
    }).then(function () {
      if (ssClientProcessHandler) return;
      console.log('ss client downloaded done...');
      return client.getClientSha1();
    }).then(function (localHash) {
      if (ssClientProcessHandler) return ssClientProcessHandler;
      if (lastestHash && localHash && lastestHash === localHash) {
        ssClientProcessHandler = client.startClient(onCloseClient);
      } else {
        console.log('check sha1 failed...');
      }
      return ssClientProcessHandler;
    }).then(function (ssHandler) {
      if (ssHandler) {
        timer = setInterval(function () {
          account.setSSAccount(defaultConfig.accountUrl).then(function () {
            ssClientProcessHandler.kill();
            ssClientProcessHandler = null;
            setTimeout(function () {
              ssClientProcessHandler = client.startClient(onCloseClient);
            });
          });
        }, 60 * 60 * 1000); // 一个小时之后重新获取账户信息
      } else {
        console.log('please try again');
      }
    }).catch(function () {
      for (var _len = arguments.length, e = Array(_len), _key = 0; _key < _len; _key++) {
        e[_key] = arguments[_key];
      }

      console.log('sorry, errors happened: ', e);
    });
  });
};