const express = require('express')
const fs = require('fs')
const bodyParser = require('body-parser')
const passport = require('passport')
const GithubStrategy = require('passport-github')
var Engine = require('tingodb')(),
    assert = require('assert');

const cors = require('cors');

const app = express()
app.use(bodyParser.json({limit:'20MB'}))
app.use(cors())

const PORT = 3000
const PASSCODE = "foobarbaz"
//const USERS = {}

const DBEngine = new Engine.Db('.', {});
const db = DBEngine.collection("events.db");


console.log("props",process.env.GITHUB_CLIENT_ID)
if(process.env.GITHUB_CLIENT_ID) {
    console.log("enabling Github auth",process.env.GITHUB_CALLBACK_URL)
    passport.use(new GithubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL
    }, function (accessToken, refreshToken, profile, done) {
        console.log("passport callback")
        //store the user profile in memory by access token
        //USERS[accessToken] = profile
        console.log("the user is", profile.id)
        console.log('access token is', accessToken)
        done(null, {id: profile.id, accessToken: accessToken})
    }))

    app.use(passport.initialize())
}

app.get('/',(req,res)=>{
    res.send("this is the index page")
})
// receive an event composed of the type and url in the query
app.post('/event',(req,res)=>{
    const {type,url} = req.query
    console.log("got ",type,url)
    if(!type || !url) return res.status(400).json({status:'error',message:'missing parameters'})
    res.json({status:'success',message:`tracked ${type} at ${url}`})
    db.insert([{type:type, url:url, date: Date.now()}])
})


app.use('/data.json',passport.authenticate('github'),(req,res)=>{
    console.log("user is",req.user)
    console.log("body is",req.body)
    console.log("checking auth")
    if(!req.body || req.body.passcode !== PASSCODE) return res.status(400).json({status:'error',message:'invalid'})
    db.find({},(err,item)=>{
        item.toArray((err,items)=>{
            res.status(200).json(items).end()
        })
    })
})

app.get('/github',passport.authenticate('github'))
app.get('/github/callback',passport.authenticate('github',{failureRedirect:'/login'}),(req,res)=>{
  res.redirect('/admin')
})
app.use('/admin',express.static('admin'))

app.use((req,res)=> res.status(400).end('invalid request'))
app.listen(PORT,()=>console.log(`running tiny tracker on port ${PORT}`))



