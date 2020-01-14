const express = require('express')
const fs = require('fs')
const bodyParser = require('body-parser')
const passport = require('passport')
const session = require('express-session');
const GithubStrategy = require('passport-github')
var Engine = require('tingodb')(),
    assert = require('assert');
const cors = require('cors');


const PORT = 3000

const ALLOWED_USERS=process.env.USERS.split(",")

const app = express()
app.use(bodyParser.json({limit:'20MB'}))
app.use(cors())




const DBEngine = new Engine.Db('.', {});
const db = DBEngine.collection("events.db");

if(process.env.GITHUB_CLIENT_ID) {
    console.log("enabling Github auth",process.env.GITHUB_CALLBACK_URL)
    passport.use(new GithubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL
    }, function (accessToken, refreshToken, profile, done) {
        console.log("github strategy callback")
        console.log("the user is", profile.id)
        console.log("profile is",profile)
        console.log('access token is', accessToken)
        if(ALLOWED_USERS.indexOf(profile.username)<0) {
          console.log("not a valid user")
        }
        done(null, {id: profile.id, username:profile.username, accessToken: accessToken})
    }))

  passport.serializeUser((user, cb) => cb(null, user))
  passport.deserializeUser((obj, cb) => cb(null, obj))
  
  app.use(require('cookie-parser')());  
  app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
  app.use(passport.initialize())
  app.use(passport.session())

}

app.get('/',(req,res)=>{
    console.log("/ user is",req.user)
    res.send("this is the index page")
})
// receive an event composed of the type and url in the query
app.post('/event',(req,res)=>{
    console.log("/event user is",req.user)
    const {type,url} = req.query
    console.log("got ",type,url)
    if(!type || !url) return res.status(400).json({status:'error',message:'missing parameters'})
    res.json({status:'success',message:`tracked ${type} at ${url}`})
    db.insert([{type:type, url:url, date: Date.now()}])
})

const allowed = (req,res,done) => {
    console.log("verifyihng the user",req.user)
  if(!req.user) return res.status(400).json({status:'error',message:'not logged in'})
  if(ALLOWED_USERS.indexOf(profile.username)<0) {
    console.log("not a valid user")
  }
  done()
};

app.use('/data.json', allowed,(req,res)=>{
    console.log("checking auth")
    console.log("/data user is",req.user)
    //return res.status(400).json({status:'error',message:'invalid'})
    db.find({},(err,item)=>{
        item.toArray((err,items)=>{
            res.status(200).json(items).end()
        })
    })
})

app.get('/github',
        passport.authenticate('github'))
app.get('/github/callback',
        passport.authenticate('github',{failureRedirect:'/login'}),
        (req,res)=>{
          res.redirect('/admin')
})
app.use('/admin',express.static('admin'))

app.use((req,res)=> res.status(400).end('invalid request'))
app.listen(PORT,()=>console.log(`running tiny tracker on port ${PORT}`))



