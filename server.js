const express = require('express')
const fs = require('fs')
const bodyParser = require('body-parser')
const passport = require('passport')
const session = require('express-session');
const GithubStrategy = require('passport-github')
const formidable = require('formidable')
const Engine = require('tingodb')()
const cors = require('cors');
const jsonlines = require('jsonlines')

function setupOptions() {
    let options = {
        AUTH_ENABLED:true
    }
    if(fs.existsSync('config.json')) {
        options = Object.assign(options,JSON.parse(fs.readFileSync('config.json').toString()))
    }
    if(process.env.USERS) options.USERS = process.env.USERS
    if(!options.USERS) throw new Error("USERS not defined")
    options.ALLOWED_USERS=options.USERS.split(",")

    if(process.env.GITHUB_CALLBACK_URL) options.GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
    if(!options.GITHUB_CALLBACK_URL) throw new Error("GITHUB_CALLBACK_URL not defined")

    if(process.env.GITHUB_CLIENT_ID) options.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
    if(!options.GITHUB_CLIENT_ID) throw new Error("GITHUB_CLIENT_ID not defined")
    if(process.env.GITHUB_CLIENT_SECRET) options.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
    if(!options.GITHUB_CLIENT_SECRET) throw new Error("GITHUB_CLIENT_SECRET not defined")
    if(process.env.PORT) options.PORT = process.env.PORT
    if(!options.PORT) throw new Error("PORT not defined")

    console.log("options",options)
    return options
}

let options = setupOptions()


const app = express()
app.use(bodyParser.json({limit:'20MB'}))
app.use(bodyParser.urlencoded())
app.use(cors())


const DBEngine = new Engine.Db('.', {});
const db = DBEngine.collection("events.db");
const USERS = {}

if(options.AUTH_ENABLED) {
    passport.use(new GithubStrategy({
        clientID: options.GITHUB_CLIENT_ID,
        clientSecret: options.GITHUB_CLIENT_SECRET,
        callbackURL: options.GITHUB_CALLBACK_URL
    }, function (accessToken, refreshToken, profile, done) {
        console.log("github strategy callback", accessToken)
        if (options.ALLOWED_USERS.indexOf(profile.username) < 0) return
        USERS[accessToken] = profile
        done(null, {username: profile.username, accessToken: accessToken})
    }))

    passport.serializeUser((user, cb) => cb(null, user))
    passport.deserializeUser((obj, cb) => cb(null, obj))

    app.use(require('cookie-parser')());
    app.use(require('express-session')({secret: 'keyboard cat', resave: true, saveUninitialized: true}));
    app.use(passport.initialize())
    app.use(passport.session())
}

function authTemplate(req) {
    return `<html>
    <body>
        <p>great. you are authenticated. you may close this window now.</p>
        <script>
            document.body.onload = function() {
                const injectedUser = ${JSON.stringify(req.user)}
                console.log("the user is",injectedUser)
                const msg = {payload:injectedUser, status:'success'}
                console.log("msg",msg)
                console.log('location',window.opener.location,'*')
                window.opener.postMessage(msg, '*')
                console.log("done posting a message")
            }
    </script>
    </body>
    </html>`
}

app.get('/',(req,res)=>{
    res.send("this is the index page")
})
// receive an event composed of the type and url in the query
const parseForm = (req,res,done) => {
    new formidable.IncomingForm().parse(req, (err,fields,files)=>{
        req.body = fields
        done()
    })
}

let stats = {}
function inc(obj, key, key2) {
    if(!obj[key]) obj[key] = {}
    if(!obj[key][key2]) obj[key][key2] = 0
    obj[key][key2] += 1
}

function processEvent(event) {
    db.insert([event])
    const date = new Date()
    date.setTime(event.date)
    const year = date.getUTCFullYear()
    if(!stats[year]) stats[year] = {}
    const month = date.getUTCMonth()
    if(!stats[year][month]) stats[year][month] = {}
    const day = date.getUTCDate()
    if(!stats[year][month][day]) stats[year][month][day] = {}
    const bucket = stats[year][month][day]

    if(event.type) {
        if(!bucket.type) bucket.type = {}
        if(!bucket.type[event.type]) bucket.type[event.type] = 0
        bucket.type[event.type] += 1
    }
    if(event.url) {
        if(!bucket.url) bucket.url = {}
        if(!bucket.url[event.url]) bucket.url[event.url] = 0
        bucket.url[event.url] += 1
    }
    if(event.referrer) inc(bucket,'referrer',event.referrer)
    if(event.userAgent) inc(bucket,'userAgent',event.userAgent)
    if(event.region) inc(bucket,'region',event.region)
    if(event.lang) inc(bucket,'lang',event.lang)
    if(event.charset) inc(bucket,'charset',event.charset)

    //console.log("inserted %o",bucket)
}

function saveStats() {
    console.log("saving")
    fs.writeFileSync("stats.json",JSON.stringify(stats,null,'  ').toString())
}
function loadStats() {
    try {
        stats = JSON.parse(fs.readFileSync('stats.json').toString())
        console.log("loaded stats %o",stats)
    } catch (e) {
        console.log("error loading stats.json. starting over")
        stats = {}
    }
}
loadStats()
setInterval(saveStats,1000*5) //save once a minute

app.use('/event', parseForm, (req,res)=>{
    let event = Object.assign({},req.body)
    event = Object.assign(event,req.query)
    event.date = Date.now()
    if(!event.type) return res.status(400).json({status:'error',message:'missing parameters at least for type'})
    res.json({status:'success',message:`tracked ${event.type}`})
    processEvent(event)
})

const allowed = (req,res,done) => {
    if(!options.AUTH_ENABLED) return done()
    const token = req.headers['access-key']
    const user = USERS[token]
    if(!user) return res.json({success:false,message:'invalid access token, cannot find user'})
    console.log("the user is",user.username)
    req.user = user
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
app.use('/data.jsonline', allowed, (req,res)=>{
    const stream = db.find({}).stream()
    res.status(200)
    const str = jsonlines.stringify()
    str.pipe(res)
    stream.on('data',(row)=> str.write(row))
    stream.on('end',()=> str.end())
})
app.use('/stats.json', allowed, (req,res)=>{
    res.status(200).json(stats).end()
})

app.get('/github',  passport.authenticate('github'))
app.get('/github/callback', passport.authenticate('github',{failureRedirect:'/login'}),
        (req,res)=> res.send(authTemplate(req)))
app.use('/admin',express.static('admin'))
app.use((req,res)=> res.status(400).end('invalid request'))
app.listen(options.PORT,()=>console.log(`running tiny tracker on port ${options.PORT} with github auth`))



