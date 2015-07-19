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

from helper_operations import search_index


class LandingPageHandler(Handler):
    def get(self):
    	if not self.user:
    		return self.render('index.html')
        
        # means user is atleast logged in to his google account
        user_test = check_user_warm_cache(self.user_key)

        if user_test:
            return self.redirect('/feed')
        # only render the cerate user page if the user is not in db
        else:
            return self.render('create_user.html')

    def post(self):
        if not self.user:
            return self.render('index.html')

        user_test = check_user_warm_cache(self.user_key)
        if user_test:
            return self.redirect('/feed')
        	

class DatastoreHandler(Handler):
    def get(self):
        g = "group-1"
        result = GroupPost.fetch_posts_by_group(group_id = g, limit = None, cursor = None)
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
    (r'/edit-group/([a-z0-9-]{3,20})', GroupEditHandler),
    ('/ajax/post-group', GroupPostHandler),
    ('/ajax/group-text-search', GroupTextSearchHandler),
    ('/generate-notifications/posts', NotificationWorkerHandler),
    ('/ajax/get-user-groups', GetUserGroupsHandler),
    ('/ajax/get-group-feed', GetGroupFeedHandler),
    ('/ajax/check-post-notifications', CheckPostNotificationHandler),
    ('/ajax/get-post-notifications', GetPostNotificationsHandler),
    ('/ajax/get-request-notifications', RequestNotificationHandler),
    ('/ajax/complete-request', CompleteRequestHandler),
    ('/datastore', DatastoreHandler)
], debug=True)   

