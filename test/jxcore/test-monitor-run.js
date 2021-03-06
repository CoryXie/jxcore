// Copyright & License details are available under JXCORE_LICENSE file


if (process.isPackaged)
  return;


var http = require("http"),
  fs = require('fs'),
  path = require("path"),
  childprocess = require("child_process"),
  assert = require('assert');

var port = 17777;
var finished = false;
var subscribed = false;

// neutralize old tmp file
var oldLog = path.join(__dirname, "test-monitor-run-app-tmp.js");
if (fs.existsSync(oldLog))
  fs.writeFileSync(oldLog, "");

// monitored app will just create an http server
var baseFileName = "__test-monitor-run-app-tmp.js";
var logFileName = "__test-monitor-run-app-tmp-monitor.log";
var appFileName = path.join(__dirname, baseFileName);

var str = 'setTimeout(process.exit, 30000);';  // let it end after 30 secs
fs.writeFileSync(appFileName, str);

var cmd = '"' + process.execPath + '" monitor ';

// kill monitor if stays as dummy process
jxcore.utils.cmdSync(cmd + "stop");

process.on('exit', function (code) {
  jxcore.utils.cmdSync(cmd + 'stop');
  var _cmd = process.platform == 'win32' ? 'del /q ' : 'rm -f ';
  jxcore.utils.cmdSync(_cmd + "*monitor*.log");
  if (fs.existsSync(appFileName))
    fs.unlinkSync(appFileName);

  assert.ok(finished, "Test unit did not finish.");
  assert.ok(subscribed, "Application did not subscribe to a monitor with `jx monitor run` command.");
});

// calls monitor and gets json: http://localhost:17777/json
var getJSON = function (cb) {
  var options = {
    host: 'localhost',
    port: port,
    path: '/json'
  };

  http.get(options, function (res) {
    res.setEncoding('utf8');
    var body = "";
    res.on('data', function (chunk) {
      body += chunk.toString();
    });
    res.on('end', function () {
      cb(false, body);
    });
  })
    .on("error", function (err) {
      cb(true, err);
    });
};

var traceWin = function (cmd, res) {

  if (process.platform !== "win32") return;
  console.log("Output from running the command " + cmd + ":");
  console.log(JSON.stringify(res, null, 4));
};


// stops monitor first if it's running
//jxcore.utils.cmdSync(cmd + "stop");

// we use setTimeout() here, because we cannot be sure on Windows,
// that cmdSync will not exit sooner that jx monitor cmd will complete
// so after it completes we wait for another 1 second

// ########################## jx monitor start
var ret = jxcore.utils.cmdSync(cmd + "start");
traceWin(cmd + "start", ret);
assert.ok(ret.exitCode <= 0, "Monitor did not start after `start` command. \n", JSON.stringify(ret));

// ########################## jx monitor run test-monitor-run-app.js

// this should be launched in background. & at the end of cmd does not work proper on windows
var out = fs.openSync(logFileName, 'a');
var err = fs.openSync(logFileName, 'a');
var child = childprocess.spawn(process.execPath, [ "monitor", "run", appFileName ] , { detached: true, stdio: [ 'ignore', out, err ] });
child.unref();

var start = Date.now();

var check = function() {
  getJSON(function (err, txt) {

    // should be no error and json should be returned with subscribed application data
    // including "pid" number
    if (!err && txt && txt.length && txt.indexOf(baseFileName) > -1) {
      subscribed = true;
      finished = true;
      return;
    }

    if (Date.now() - start < 20000)
      setTimeout(check, 1000);
    else
      finished = true;
  });
};

check();