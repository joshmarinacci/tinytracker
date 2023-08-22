
TinyTracker requires setting the following if you are not using auth.

```
"PORT": "3965",
"AUTH_ENABLED": false
```

In this configuration tinytracker will run on port 3965.  Any website can post
events to it by posting to yourhost:3965/event. Usually this is done with the following
JS in your page:

```javascript
    const data = new FormData()
    data.set('type','pageload')
    data.set('url',document.location.toString())
    data.set('referrer',document.referrer)
    data.set('userAgent',navigator.userAgent)
    navigator.sendBeacon('http://localhost:3965/event',data)
```

You can retrive your current stats by GETTING the following urls:

`/data.json`  get the full data set 
`/data.jsonline` get the full data set as a newline delimited JSON stream
`/stats.json` calculated statistics. These are typically updated once per minute

# with github auth

Create a github app token with a client id and secret and callback url. The callback URL
should look like `https://yourhost:yourport/github/callback`.  In your config put the
list of users who should have access, and the client id, secret, and callback url. Alos set
the auth enabled to true. ex:

```json
{
  "PORT": "3965",
  "AUTH_ENABLED": true,
  "USERS": "joshmarinacci",
  "GITHUB_CLIENT_ID": "adsfasdfasdf",
  "GITHUB_CLIENT_SECRET": "asdfasdf",
  "GITHUB_CALLBACK_URL": "http://localhost:3965/github/callback"
}
```


edit .env to include your github app credentials and a comma separated list of github usernames who are allowed to access the data
You can also use config.json


