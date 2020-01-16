const express = require('express')
const fs = require('fs')
const bodyParser = require('body-parser')
const passport = require('passport')
const session = require('express-session');
const GithubStrategy = require('passport-github')
var Engine = require('tingodb')(),
    assert = require('assert');
const cors = require('cors');

function setupOptions() {
    let options = {}
    if(fs.existsSync('config.json')) {
        options = Object.assign({},JSON.parse(fs.readFileSync('config.json').toString()))
    }
    if(process.env.USERS) options.USERS = process.env.USERS
    options.ALLOWED_USERS=options.USERS.split(",")
    if(process.env.GITHUB_CALLBACK_URL) options.GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
    console.log("options",options)
    return options
}

let options = setupOptions()


const app = express()
app.use(bodyParser.json({limit:'20MB'}))
app.use(cors())


const DBEngine = new Engine.Db('.', {});
const db = DBEngine.collection("events.db");

console.log("enabling Github auth",options.GITHUB_CALLBACK_URL)
passport.use(new GithubStrategy({
    clientID: options.GITHUB_CLIENT_ID,
    clientSecret: options.GITHUB_CLIENT_SECRET,
    callbackURL: options.GITHUB_CALLBACK_URL
}, function (accessToken, refreshToken, profile, done) {
    console.log("github strategy callback")
    if(options.ALLOWED_USERS.indexOf(profile.username)<0) return
    done(null, {username:profile.username})
}))

passport.serializeUser((user, cb)  => cb(null, user))
passport.deserializeUser((obj, cb) => cb(null, obj))

app.use(require('cookie-parser')());  
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
app.use(passport.initialize())
app.use(passport.session())


app.get('/',(req,res)=>{
    res.send("this is the index page")
})
// receive an event composed of the type and url in the query
app.use('/event',(req,res)=>{
    const {type,url} = req.query
    console.log("got ",type,url,req.body)
    if(!type || !url) return res.status(400).json({status:'error',message:'missing parameters'})
    res.json({status:'success',message:`tracked ${type} at ${url}`})
    db.insert([{type:type, url:url, date: Date.now()}])
})

const allowed = (req,res,done) => {
    console.log("verifying the user",req.user)
    if(!req.user) return res.status(400).json({status:'error',message:'not logged in'})
    if(options.ALLOWED_USERS.indexOf(req.user.username)<0) {
      console.log("not a valid user")
      return res.status(400).json({status:'error', message:'user not approved'})
    }
    done()
};

app.use('/data.json', allowed, (req,res)=>{
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
app.listen(options.PORT,()=>console.log(`running tiny tracker on port ${options.PORT} with github auth`))



