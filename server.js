const express = require('express')
const fs = require('fs')
const bodyParser = require('body-parser')
var Engine = require('tingodb')(),
    assert = require('assert');

const cors = require('cors');

const app = express()
// app.use(bodyParser)
app.use(cors())

const PORT = 3000

const DBEngine = new Engine.Db('.', {});
const db = DBEngine.collection("events.db");

/*
collection.insert([
    {
        type:'pageload',
        url:'foo',
        date: Date.now()
    },
    {
        type:'navlink',
        url:'bar',
        date: Date.now()
    },
    {
        type:'navlink',
        url:'bar',
        date: Date.now()
    },
    ], {w:1}, function(err, result) {

})
*/

db.find({}, function(err, item) {
    item.each((err,doc) => {
        console.log(doc)
    })
});

app.get('/',(req,res)=>{
    res.send("this is the index page")
  console.log('sent the index page')
})
// receive an event composed of the type and url in the query
app.post('/event',(req,res)=>{
    const {type,url} = req.query
    console.log("getting an event",type,url)
    if(!type || !url) return res.status(400).json({status:'error',message:'missing parameters'})
    res.json({status:'success',message:`tracked ${type} at ${url}`})
    db.insert([{type:type, url:url, date: Date.now()}])
})

app.get('/data',(req,res)=>{
    db.find({},(err,item)=>{
        item.toArray((err,items)=>{
            res.status(200).json(items).end()
        })
    })
})

app.use((req,res)=> res.status(400).end('invalid request'))
app.listen(PORT,()=>console.log(`running tiny tracker on port ${PORT}`))



