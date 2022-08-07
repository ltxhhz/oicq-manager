const { Manager } = require("./build");
const manager = new Manager();
manager.add({
  id: 'ltxhhz',
  label: '测试',
  install(manager) {
    manager.clientOnce('message.group.normal', (e) => {
      console.log(`插件[${this.label}]收到了群`, `[${e.group_name}]${e.group_id} 的消息:`, e.message);
    })
  },
});

manager.login({
  uin: 10000, // 输入账号
  pwd: 'pwd', // 输入密码或md5
  oicqConfig: {
    ignore_self: false,
    // log_level: 'trace'
  }
}).then(Manager.auxiliaryVerification).then(e => {
  console.log(e);
  if (e) {
    console.log(`当前第${Object.keys(manager.clientList).length}个实例已登录`);
  }
}) //.then(()=>{
// manager.login({
//   uin: 其他账号,
//   pwd: '密码',
//   oicqConfig: {
//     ignore_self: false
//   }
// }).then(Manager.auxiliaryVerification).then(e => {
//   console.log(e);
//   if (e) {
//     console.log(`当前第${Object.keys(manager.clientList).length}个实例已登录`);
//   }
// })
//})
