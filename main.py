import webapp2

from google.appengine.api import users
from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.ext import blobstore


from utility_handler import Handler
from feed_handler import FeedHandler
from group_handler import *
from notification_handler import NotificationWorkerHandler, RequestNotificationHandler, CompleteRequestHandler
from profile_handler import ViewProfileHandler, EditProfileHandler,TestImageUploader

from models import User

class LandingPageHandler(Handler):
    def get(self):
    	if self.user:
    		self.redirect('/feed')
        else:
        	self.render('base.html')

class DatastoreHandler(Handler):
	def get(self):
		user_id = self.user.user_id()
		user = User.get_by_id(user_id)
		result = user.key
		self.render('datastore.html', result = result)

app = webapp2.WSGIApplication([
    ('/', LandingPageHandler),
    ('/feed', FeedHandler),
    ('/view-profile', ViewProfileHandler),
    ('/edit-profile', EditProfileHandler),
    ('/create-group', CreateGroupHandler),
    (r'/group/([a-z0-9-]{3,20})', GroupLandingPageHandler),
    (r'/join-group/([a-z0-9-]{3,20})', GroupJoiningHandler),
    (r'/admin-group/([a-z0-9-]{3,20})', GroupRequestAdminHandler),
    (r'/leave-group/([a-z0-9-]{3,20})', GroupLeavingHandler),
    (r'/post-group/([a-z0-9-]{3,20})', GroupPostHandler),
    ('/generate-notifications/posts', NotificationWorkerHandler),
    ('/generate-notifications/requests', RequestNotificationHandler),
    (r'/complete-request/([a-z0-9]+)', CompleteRequestHandler),
    ('/datastore', DatastoreHandler)
], debug=True)   
