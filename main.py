import webapp2
import datetime

from google.appengine.api import users
from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.ext import blobstore


from utility_handler import Handler
from feed_handler import *
from group_handler import *
from notification_handler import *
from profile_handler import *

from models import *

class LandingPageHandler(Handler):
    def get(self):
    	if self.user:
    		self.redirect('/feed')
        else:
        	self.render('index.html')

class DatastoreHandler(Handler):
    def get(self):
        user_key = self.user_key
        group_key = ndb.Key(Group, "private-1")

        group_key = ndb.Key(Group, "private-1")
        r1 = PrivateRequest.test_existing_request(user_key, group_key, 'join')

        self.render('datastore.html', result = user_key, result2 = r1)

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
    ('/ajax/get-user-groups', GetUserGroupsAjax),
    ('/ajax/get-group-feed', GetGroupFeedAjax),
    ('/ajax/get-post-notifications', GetPostNotificationsAjax),
    ('/ajax/update-post-notifications-read-status', UpdatePostNotificationsStatus),
    ('/ajax/get-request-notifications', RequestNotificationHandler),
    ('/ajax/complete-request', CompleteRequestAjax),
    ('/datastore', DatastoreHandler)
], debug=True)   

