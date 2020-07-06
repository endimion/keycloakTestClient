var Keycloak = require("keycloak-connect");
const ngrok = require("ngrok");
var fs = require("fs");
var express = require("express");
var session = require("express-session");
const path = require("path");
var cors = require("cors");
const mustacheExpress = require("mustache-express");

const HOST = "my-awesome-sauce-app.com";
const public = path.join(__dirname, "public");
const protectedRoutes = ["/adacom/login","/login", "/upload"];

var memoryStore = new session.MemoryStore();

var keycloak = new Keycloak({
  store: memoryStore,
  scope: 'openid SEAL-isErasmusAegean', 
});

var app = express();

var originsWhitelist = ["my-awesome-sauce-app.com"];
var corsOptions = {
  origin: function(origin, callback) {
    var isWhitelisted = originsWhitelist.indexOf(origin) !== -1;
    callback(null, isWhitelisted);
  }
};

app.use(cors(corsOptions));

var sess = {
  secret: "nadal federer djoker murray",
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
  cookie: {
    secure: false,
    maxAge: 30000
  },
  expires: new Date(Date.now() + (30 * 86400 * 1000))
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1); // trust first proxy
  sess.cookie.secure = true; // serve secure cookies
}

app.use(session(sess));
app.use(keycloak.middleware());
app.use(express.static("public"));

app.engine("html", mustacheExpress());
app.set("view engine", "html");
app.set("views", __dirname + "/public");

// Protected Routes
app.get(protectedRoutes, keycloak.protect(), (req, res) => {
  console.log("we accessed a protected root!");
  // see mockJwt.json for example response
  const idToken = req.kauth.grant.access_token.content;
  console.log(req.kauth.grant.access_token.content);
  // console.log(idToken)
  const userDetails = {
    email: idToken.email,
    given_name: idToken.eidas_firstName,
    family_name: idToken.eidas_familyName,
    sending_institution_page: idToken.sending_institution_page,
    gender: idToken.gender,
    institutional_email: idToken.institutional_email,
    person_identifier: idToken.eidas_personIdentifier,
    mobile_phone: idToken.mobile_phone,
    sending_institution_name: idToken.sending_institution_name,
    sending_institution_address: idToken.sending_institution_address,
    place_of_birth: idToken.place_of_birth,
    date_of_birth: idToken.eidas_dateOfBirth,
    sending_institution_name_2: idToken.sending_institution_name_2
  };

  res.render("authenticated", userDetails);
});



app.get("/adacom/logoff", keycloak.protect(), (req, res) => {
  console.log("logout clicked");
  // Due to CORS setup on the keycloak server, we can't call the /logout
  // route directly through the Angular client. We need to pass the URL
  // from the server (with CORS headers) and then call that URL from the client.
  // Reference: https://stackoverflow.com/questions/49835830/res-redirect-cors-not-working-in-mean-app
  res.send("https://" + HOST + "/logout");
});

// free for all Routes
app.get(["/","/adacom/","favicon", "/favicon","/favicon.ico", "favicon.ico","/favicon.ico/", "/*" ], (req, res) => {
  res.render("index", { name: "Sherlynn" });
});

// Statically serve the Angular frontend
app.use(
  express.static(public, {
    maxAge: "1h"
  }),
  keycloak.protect(),
  (req, res) => {
    console.log("static :: " + req.originalUrl)
    if (protectedRoutes.indexOf(req.originalUrl) == -1) {
      console.log(req.originalUrl + ": Invalid route!");
      res.sendStatus(404);
    }
  }
);

// run the app server and tunneling service
const server = app.listen(8088, () => {
  ngrok.connect(8088).then(ngrokUrl => {
    endpoint = ngrokUrl;
    console.log(`Login Service running, open at ${endpoint}`);
  });
});
