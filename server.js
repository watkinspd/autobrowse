var express = require('express');
var validUrl = require('valid-url');
var check = require('check-types');
var passport = require('passport');
var util = require('util');
var session = require('express-session');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var GitHubStrategy = require('passport-github2').Strategy;
var partials = require('express-partials');
var fs = require('fs');

var DEFAULT_TIMER = process.env.DEFAULT_TIMER || "40000";
var curIndex = 0; // a var to hold the current index of the current url

// environment variables take precedence over vault.json
var vault = {
  "GITHUB_CLIENT_ID" : process.env.GITHUB_CLIENT_ID,
  "GITHUB_CLIENT_SECRET" : process.env.GITHUB_CLIENT_SECRET,
  "GITHUB_CALLBACK_URL" : process.env.GITHUB_CALLBACK_URL,
  "AUTHORIZED_USER_EMAIL" : process.env.AUTHORIZED_USER_EMAIL
};
if (!vault.GITHUB_CLIENT_ID) {
  var vaultF = fs.readFileSync("./vault.json");
  var vault = JSON.parse(vaultF);
};


// careful about how you set the path to urlList.json
// example where is /data folder relative to the running code?
// if running locally via node then you can have a data folder
// in the folder where server.js is
// but if you are on some platform where you mounted /data as a volume
// then you have to be sure about how to set the enviromnment variable with the
// file path
var URLLIST_LOCATION = process.env.URLLIST_LOCATION || './data/urlList.json';

var urlList = readOrSetUrlList();

function readOrSetUrlList() {

  // set a default list of urls
  var urlR = [{"url":"https://google.com","timer":"40000"},
              {"url":"https://bing.com","timer":"20000"},]

  // if there is a urlList.json file then use it
  try {
    var urlF = fs.readFileSync(URLLIST_LOCATION);
    var urlR = JSON.parse(urlF);
  }
  catch (e) {
    console.log("no " + URLLIST_LOCATION + " found.");
  }
  return(urlR);
}

function writeUrlListToDisk(urlList) {
  var urlListAsText = JSON.stringify(urlList);
  try {
    fs.writeFileSync(URLLIST_LOCATION, urlListAsText);
  }
  catch (e) {
    console.log ('error on filewrite');
  }
  return;
}

var app = express();

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete GitHub profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(new GitHubStrategy({
    clientID: vault.GITHUB_CLIENT_ID,
    clientSecret: vault.GITHUB_CLIENT_SECRET,
    callbackURL: vault.GITHUB_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

function responseHTML(urlItem) {
var contentHTML = '<script type="text/javascript">' +
'  var wnd = window.open('+ "'" + urlItem.url + "'" +');' +
'  setTimeout(function() { ' +
'    wnd.window.close(); ' +
'    window.location.reload(true);'+
'  },'+  urlItem.timer + ');' +
'</script>';

return(contentHTML);
}


// Simple route middleware to ensure user is authenticated and authorized
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
//   Hacked an access control measure for a single user based on github account email
function ensureAuthenticated(req, res, next) {
  console.log ('req.isAuthenticated=' + req.isAuthenticated)
  if (req.isAuthenticated() && req.user.emails[0].value === vault.AUTHORIZED_USER_EMAIL ) { return next(); }
  res.redirect('/login')
}

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));

app.get('/help', function(req, res) {
    res.format({
      'text/plain' : function () {
          res.send('/run, /list, /add/?timer=<milliseconds>&url=https://<name> , /remove/?number=<number>');
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

app.get('/list', ensureAuthenticated, function(req, res) {
    var i = 0;
    var resText = '';

    urlList.forEach(function(value) {
        resText = resText + i + 'timer=' + value.timer + ', url=' + value.url + "\n";
        i++;
    });

    res.format({
      'text/plain' : function () {
          res.send(resText);
        }
    });
});

app.get('/add', ensureAuthenticated, function(req, res) {
    if (validUrl.isUri(req.query.url)) {

      //url was valid so add it the list and write the updated list to disk

      urlList.push( { "url": req.query.url, "timer": (req.query.timer || DEFAULT_TIMER) } );
      writeUrlListToDisk(urlList);

      var i = 0;
      var resText = '';

      urlList.forEach(function(value) {
          resText = resText + i + 'timer=' + value.timer + ', url=' + value.url + "\n";
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

app.get('/remove', ensureAuthenticated, function(req, res) {
    var num = parseInt(req.query.number);

    if (check.integer(num)) {
        if (num >= 0 && num < urlList.length) {
        // number to delete was within range so remove it and write updated
        // list to disk
            urlList.splice(num,1);
            writeUrlListToDisk(urlList);

            var i = 0;
            var resText = '';

            urlList.forEach(function(value) {
                resText = resText + i + 'timer=' + value.timer + ', url=' + value.url + "\n";
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

app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHub will redirect the user
//   back to this application at /auth/github/callback
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(8080);
