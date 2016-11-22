# [Thought Share](https://thought-share.appspot.com/)
> A simple social network

https://thought-share.appspot.com

## Some features
* Build user profiles with custom profile pictures.
* Create groups and build communities.
* Post in groups or edit your previous posts.
* Private groups.
* Instant search to find groups.
* Notifications for group posts.
* Requests for joining/adminship of private groups.
* Nice clean user interface inspired from Google's Material UI.

*Please note that [Thought Share](https://thought-share.appspot.com) is still under development. Currently, you can sign-up only via your Google account.*


## Tech-stack used (for developers)

### Backend
* Hosted on [Google App Engine](https://cloud.google.com/appengine/docs/python/ "App Engine Python") and built using the [webapp2](https://cloud.google.com/appengine/docs/python/tools/webapp2) framework.
* [Google Datastore NDB](https://cloud.google.com/appengine/docs/python/ndb/) for database.
* [Jinja2](http://jinja.pocoo.org/docs/dev/) as the templating language.
* [Blobstore](https://cloud.google.com/appengine/docs/python/blobstore/) to host images.
* Google's [Images](https://cloud.google.com/appengine/docs/python/images/) API to serve/crop images on go.
* Instant search built on Google's [Search API](https://cloud.google.com/appengine/docs/python/search/).
* User accounts are handled using Google's [Users API](https://cloud.google.com/appengine/docs/python/users/)

### Frontend
* [KnockoutJS](http://knockoutjs.com/)
* [jQuery](https://jquery.com/)
* [RequireJS](http://requirejs.org/) to load modules.
* [SammyJS](http://sammyjs.org/) for front-end routing.
* [Velocity](http://velocityjs.org/) as the animation engine.
* Pop-up modals are built using [simple-modals](http://abhimanyupathania.github.io/simple-modals/) (written by myself).
* [Material Icons](https://material.io/icons/) for the icon-set.
