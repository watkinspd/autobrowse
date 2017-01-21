var express = require('express');
var validUrl = require('valid-url');
var check = require('check-types');

var app = express();

var urlList = ['https://google.com', 'https://bing.com' ]

var curIndex = 0; // a var to hold the current index of the current url

function responseHTML(url) {
var contentHTML = '<script type="text/javascript">' +
'  var wnd = window.open('+ "'" + url + "'" +');' +
'  setTimeout(function() { ' +
'    wnd.window.close(); ' +
'    window.location.reload(true);'+
'  },12000);' +
'</script>';

return(contentHTML);
}

app.get('/help', function(req, res) {
    res.format({
      'text/plain' : function () {
          res.send('/run, /list, /add/?url=https://<name> , /remove/?number=<number>');
        }
    });
});

app.get('/run', function(req, res) {
    res.format({
      'text/html' : function () {
        res.send(responseHTML(urlList[curIndex]));
      }
    });
    curIndex++; //increment the index
    if(curIndex === urlList.length) curIndex=0; //reset counter
});

app.get('/list', function(req, res) {
    var i = 0;
    var resText = '';

    urlList.forEach(function(value) {
        resText = resText + i + ' ' + value + "\n";
        i++;
    });

    res.format({
      'text/plain' : function () {
          res.send(resText);
        }
    });
});

app.get('/add', function(req, res) {
    if (validUrl.isUri(req.query.url)) {
      urlList.push(req.query.url);
      var i = 0;
      var resText = '';

      urlList.forEach(function(value) {
          resText = resText + i + ' ' + value + "\n";
          i++;
      });
      res.format({
        'text/plain' : function () {
            res.send(resText);
          }
      });
  }
  else {
      res.format({
        'text/plain' : function () {
            res.send('Not a valid url. Got >>' + req.query.url);
          }
      });
  }
});

app.get('/remove', function(req, res) {
    var num = parseInt(req.query.number);

    if (check.integer(num)) {
        if (num >= 0 && num < urlList.length) {

            urlList.splice(num,1);
            var i = 0;
            var resText = '';

            urlList.forEach(function(value) {
                resText = resText + i + ' ' + value + "\n";
                i++;
            });

            res.format({
              'text/plain' : function () {
                  res.send(resText);
                }
            });
          }
        else {
          res.format({
            'text/plain' : function () {
                res.send('Number not in range. Got >>' + req.query.number);
              }
          });
        }

    }
    else {
      res.format({
        'text/plain' : function () {
            res.send('Not a valid number. Got >>' + req.query.number);
          }
      });
    }
});

app.listen(8080);
